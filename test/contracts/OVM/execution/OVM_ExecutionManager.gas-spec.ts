import { expect } from '../../../setup'
import { deployContractCode } from '../../../helpers/utils'

/* External Imports */
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { Contract, ContractFactory, Signer } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'

/* Internal Imports */
import {
  makeAddressManager,
  NON_ZERO_ADDRESS,
  NON_NULL_BYTES32,
  GasMeasurement,
  DUMMY_BYTES32,
} from '../../../helpers'

const DUMMY_GASMETERCONFIG = {
  minTransactionGasLimit: 0,
  maxTransactionGasLimit: NON_NULL_BYTES32,
  maxGasPerQueuePerEpoch: NON_NULL_BYTES32,
  secondsPerEpoch: NON_NULL_BYTES32,
}

const DUMMY_GLOBALCONTEXT = {
  ovmCHAINID: 420,
}

const QUEUE_ORIGIN = {
  SEQUENCER_QUEUE: 0,
  L1TOL2_QUEUE: 1,
}

const getCreateAddress = async (stateManager: Contract, creator: string) => {
  let creatorNonce = await stateManager.getAccountNonce(creator)
  let createAddress = ethers.utils.getContractAddress({
    from: creator,
    nonce: creatorNonce,
  })
  return createAddress
}

describe('OVM_ExecutionManager Benchmarks', () => {
  describe('em.run() benchmark: executing a minimal contract', async () => {
    let wallet: Signer
    let Factory__OVM_ExecutionManager: ContractFactory
    let OVM_ExecutionManager: Contract
    let MOCK__STATE_MANAGER: MockContract
    let AddressManager: Contract
    let targetContractAddress: string
    let gasMeasurement: GasMeasurement
    let DUMMY_TRANSACTION
    before(async () => {
      ;[wallet] = await ethers.getSigners()
      Factory__OVM_ExecutionManager = await ethers.getContractFactory(
        'OVM_ExecutionManager'
      )

      DUMMY_TRANSACTION = {
        timestamp: 111111111111,
        blockNumber: 20,
        l1QueueOrigin: QUEUE_ORIGIN.SEQUENCER_QUEUE,
        l1TxOrigin: NON_ZERO_ADDRESS,
        entrypoint: NON_ZERO_ADDRESS, // update this below
        gasLimit: 10_000_000,
        data: 0,
      }

      // Deploy a simple contract that just returns successfully with no data
      targetContractAddress = await deployContractCode(
        '60206001f3',
        wallet,
        10_000_000
      )
      DUMMY_TRANSACTION.entrypoint = targetContractAddress

      AddressManager = await makeAddressManager()

      // deploy the state manager and mock it for the state transitioner
      MOCK__STATE_MANAGER = await smockit(
        await (await ethers.getContractFactory('OVM_StateManager')).deploy(
          NON_ZERO_ADDRESS
        )
      )

      // Setup the SM to satisfy all the checks executed during EM.run()
      MOCK__STATE_MANAGER.smocked.isAuthenticated.will.return.with(true)
      MOCK__STATE_MANAGER.smocked.getAccountEthAddress.will.return.with(
        targetContractAddress
      )
      MOCK__STATE_MANAGER.smocked.hasAccount.will.return.with(true)
      MOCK__STATE_MANAGER.smocked.testAndSetAccountLoaded.will.return.with(true)

      await AddressManager.setAddress(
        'OVM_StateManagerFactory',
        MOCK__STATE_MANAGER.address
      )

      gasMeasurement = new GasMeasurement()
      await gasMeasurement.init(wallet)
      OVM_ExecutionManager = (
        await Factory__OVM_ExecutionManager.deploy(
          AddressManager.address,
          DUMMY_GASMETERCONFIG,
          DUMMY_GLOBALCONTEXT
        )
      ).connect(wallet)
    })
    it('Gas cost of run', async () => {
      const gasCost = await gasMeasurement.getGasCost(
        OVM_ExecutionManager,
        'run',
        [DUMMY_TRANSACTION, MOCK__STATE_MANAGER.address]
      )
      console.log(`      calculated gas cost of ${gasCost}`)

      const benchmark: number = 226_516
      expect(gasCost).to.be.lte(benchmark)
      expect(gasCost).to.be.gte(
        benchmark - 1_000,
        'Gas cost has significantly decreased, consider updating the benchmark to reflect the change'
      )
    })
  })
  describe('em.run() benchmark: deploying a minimal contract', async () => {
    let Helper_SimpleDeployer: Contract
    let wallet: Signer
    let OVM_SafetyChecker: Contract
    let OVM_SafetyCache: Contract
    let MOCK__OVM_DeployerWhitelist: MockContract

    let OVM_StateManager: Contract
    let AddressManager: Contract
    let gasMeasurement: GasMeasurement
    let OVM_ExecutionManager: Contract
    let DUMMY_TRANSACTION
    before(async () => {
      ;[wallet] = await ethers.getSigners()

      AddressManager = await makeAddressManager()

      // Deploy Safety Checker and register it with the Address Manager
      OVM_SafetyChecker = await (
        await ethers.getContractFactory('OVM_SafetyChecker')
      ).deploy()
      await AddressManager.setAddress(
        'OVM_SafetyChecker',
        OVM_SafetyChecker.address
      )

      // Deploy Safety Cache and register it with the Address Manager
      OVM_SafetyCache = await (
        await ethers.getContractFactory('OVM_SafetyCache')
      ).deploy(AddressManager.address)
      await AddressManager.setAddress(
        'OVM_SafetyCache',
        OVM_SafetyCache.address
      )

      // Setup Mock Deployer Whitelist and register it with the Address Manager
      MOCK__OVM_DeployerWhitelist = await smockit(
        await ethers.getContractFactory('OVM_DeployerWhitelist')
      )
      MOCK__OVM_DeployerWhitelist.smocked.isDeployerAllowed.will.return.with(
        true
      )
      await AddressManager.setAddress(
        'OVM_DeployerWhitelist',
        MOCK__OVM_DeployerWhitelist.address
      )

      // Setup the EM
      OVM_ExecutionManager = await (
        await ethers.getContractFactory('OVM_ExecutionManager')
      ).deploy(
        AddressManager.address,
        DUMMY_GASMETERCONFIG,
        DUMMY_GLOBALCONTEXT
      )

      // Deploy GasMeasurement utility
      gasMeasurement = new GasMeasurement()
      await gasMeasurement.init(wallet)

      // Setup the State Manger and modify it to allow execution to proceed
      OVM_StateManager = await (
        await ethers.getContractFactory('OVM_StateManager')
      ).deploy(await wallet.getAddress())

      // Setup the SM to satisfy all the checks executed during EM.run()
      await OVM_StateManager.putAccount(
        '0x4200000000000000000000000000000000000002',
        {
          nonce: BigNumber.from(123),
          balance: BigNumber.from(456),
          storageRoot: DUMMY_BYTES32[0],
          codeHash: DUMMY_BYTES32[1],
          ethAddress: MOCK__OVM_DeployerWhitelist.address,
        }
      )
      await OVM_StateManager.setExecutionManager(OVM_ExecutionManager.address)

      // Deploy a simple OVM-safe contract that just deploys another contract
      Helper_SimpleDeployer = await (
        await ethers.getContractFactory('Helper_SimpleOvmDeployer')
      ).deploy()

      DUMMY_TRANSACTION = {
        timestamp: 111111111111,
        blockNumber: 20,
        l1QueueOrigin: QUEUE_ORIGIN.SEQUENCER_QUEUE,
        l1TxOrigin: NON_ZERO_ADDRESS,
        entrypoint: Helper_SimpleDeployer.address,
        gasLimit: 10_000_000,
        data: Helper_SimpleDeployer.interface.encodeFunctionData(
          'deploy(uint256)',
          [0]
        ),
      }
      await OVM_StateManager.putAccount(Helper_SimpleDeployer.address, {
        nonce: BigNumber.from(123),
        balance: BigNumber.from(456),
        storageRoot: DUMMY_BYTES32[0],
        codeHash: DUMMY_BYTES32[1],
        ethAddress: Helper_SimpleDeployer.address,
      })
    })

    it('Gas Benchmark: un-cached minimal contract deployment', async () => {
      let createAddr = await getCreateAddress(
        OVM_StateManager,
        Helper_SimpleDeployer.address
      )

      // Set destination for first contract deployment
      await OVM_StateManager.putEmptyAccount(createAddr)
      const tx = await OVM_ExecutionManager.run(
        DUMMY_TRANSACTION,
        OVM_StateManager.address
      )
      await tx.wait()
      const gasCost = (await ethers.provider.getTransactionReceipt(tx.hash))
        .gasUsed
      console.log(`      calculated gas cost of ${gasCost}`)

      const benchmark: number = 581_993
      expect(gasCost).to.be.lte(benchmark)
      expect(gasCost).to.be.gte(
        benchmark - 1_000,
        'Gas cost has significantly decreased, consider updating the benchmark to reflect the change'
      )
    })

    it('Gas Benchmark: cached minimal contract deployment', async () => {
      // Set destination for second contract deployment
      let createAddr = await getCreateAddress(
        OVM_StateManager,
        Helper_SimpleDeployer.address
      )
      await OVM_StateManager.putEmptyAccount(createAddr)

      // run the exact same flow as the previous. This time the Safety Cache should recognize the string.
      const tx = await OVM_ExecutionManager.run(
        DUMMY_TRANSACTION,
        OVM_StateManager.address
      )
      await tx.wait()
      const gasCost = (await ethers.provider.getTransactionReceipt(tx.hash))
        .gasUsed
      console.log(`      calculated gas cost of ${gasCost}`)

      const benchmark: number = 415_329
      expect(gasCost).to.be.lte(benchmark)
      expect(gasCost).to.be.gte(
        benchmark - 1_000,
        'Gas cost has significantly decreased, consider updating the benchmark to reflect the change'
      )
    })

    it('Gas Benchmark: un-cached larger contract deployment ', async () => {
      DUMMY_TRANSACTION.data = Helper_SimpleDeployer.interface.encodeFunctionData(
        'deploy(uint256)',
        [1]
      )

      let createAddr = await getCreateAddress(
        OVM_StateManager,
        Helper_SimpleDeployer.address
      )
      // Set destination for first contract deployment
      await OVM_StateManager.putEmptyAccount(createAddr)
      const tx = await OVM_ExecutionManager.run(
        DUMMY_TRANSACTION,
        OVM_StateManager.address
      )
      await tx.wait()
      const gasCost = (await ethers.provider.getTransactionReceipt(tx.hash))
        .gasUsed
      console.log(`      calculated gas cost of ${gasCost}`)

      const benchmark: number = 7_044_545
      expect(gasCost).to.be.lte(benchmark)
      expect(gasCost).to.be.gte(
        benchmark - 1_000,
        'Gas cost has significantly decreased, consider updating the benchmark to reflect the change'
      )
    })

    it('Gas Benchmark: cached larger contract deployment ', async () => {
      DUMMY_TRANSACTION.data = Helper_SimpleDeployer.interface.encodeFunctionData(
        'deploy(uint256)',
        [1]
      )
      // Set destination for contract deployment
      let createAddr = await getCreateAddress(
        OVM_StateManager,
        Helper_SimpleDeployer.address
      )
      await OVM_StateManager.putEmptyAccount(createAddr)
      const tx = await OVM_ExecutionManager.run(
        DUMMY_TRANSACTION,
        OVM_StateManager.address
      )
      await tx.wait()
      const gasCost = (await ethers.provider.getTransactionReceipt(tx.hash))
        .gasUsed
      console.log(`      calculated gas cost of ${gasCost}`)

      const benchmark: number = 5_537_215
      expect(gasCost).to.be.lte(benchmark)
      expect(gasCost).to.be.gte(
        benchmark - 1_000,  
        'Gas cost has significantly decreased, consider updating the benchmark to reflect the change'
      )
    })
  })
})
