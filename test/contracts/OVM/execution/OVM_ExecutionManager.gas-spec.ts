import { expect } from '../../../setup'
import { deployContractCode } from '../../../helpers/utils'

/* External Imports */
import { ethers } from 'hardhat'
import { Contract, ContractFactory, Signer } from 'ethers'
import {
  smockit,
  MockContract,
  ModifiableContract,
  smoddit
} from '@eth-optimism/smock'

/* Internal Imports */
import {
  makeAddressManager,
  NON_ZERO_ADDRESS,
  NON_NULL_BYTES32,
  GasMeasurement,
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

const DUMMY_TRANSACTION = {
  timestamp: 111111111111,
  blockNumber: 20,
  l1QueueOrigin: QUEUE_ORIGIN.SEQUENCER_QUEUE,
  l1TxOrigin: NON_ZERO_ADDRESS,
  entrypoint: NON_ZERO_ADDRESS, // update this below
  gasLimit: 10_000_000,
  data: 0,
}

describe.only('OVM_ExecutionManager Benchmarks', () => {
  describe('em.run() benchmark: executing a minimal contract', async () => {
    let wallet: Signer  
    let Factory__OVM_ExecutionManager: ContractFactory
    let OVM_ExecutionManager: Contract
    let MOCK__STATE_MANAGER: MockContract
    let AddressManager: Contract
    let targetContractAddress: string
    let gasMeasurement: GasMeasurement
    before(async () => {
      ;[wallet] = await ethers.getSigners()
      Factory__OVM_ExecutionManager = await ethers.getContractFactory(
        'OVM_ExecutionManager'
      )
  
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
      console.log(`calculated gas cost of ${gasCost}`)

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

    let MODDABLE__STATE_MANAGER: ModifiableContract
    let AddressManager: Contract
    let gasMeasurement: GasMeasurement
    let OVM_ExecutionManager: Contract
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
      MOCK__OVM_DeployerWhitelist.smocked.isDeployerAllowed.will.return.with(true)
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
      )// .connect(wallet)
          
      // Deploy GasMeasurement utility
      gasMeasurement = new GasMeasurement()
      await gasMeasurement.init(wallet)

      // Setup the State Manger and modify it to allow execution to proceed
      MODDABLE__STATE_MANAGER = await (
        await smoddit('OVM_StateManager')
      ).deploy(
        await wallet.getAddress()
      )
      console.log('wallet address:', await wallet.getAddress())
      // Setup the SM to satisfy all the checks executed during EM.run()
      MODDABLE__STATE_MANAGER.smodify.set({
        ovmExecutionManager: OVM_ExecutionManager.address
      })
      console.log('stateManager.ovmExecutionManager:', await MODDABLE__STATE_MANAGER.ovmExecutionManager())
      console.log('stateManager.owner:', await MODDABLE__STATE_MANAGER.owner())
      // MODDABLE__STATE_MANAGER.smocked.hasAccount.will.return.with(true)
      MODDABLE__STATE_MANAGER.smodify.set({
        accounts: {
          [OVM_SafetyCache.address]: {
            nonce: 0,
            codeHash: NON_NULL_BYTES32,
            ethAddress: OVM_SafetyCache.address,
          },
          // todo remove if unneeded
          // [OVM_SafetyChecker.address]: {
          //   nonce: 0,
          //   codeHash: NON_NULL_BYTES32,
          //   ethAddress: OVM_SafetyChecker.address,
          // },
          [MOCK__OVM_DeployerWhitelist.address]: {
            nonce: 0,
            codeHash: NON_NULL_BYTES32,
            ethAddress: MOCK__OVM_DeployerWhitelist.address,
          },

        },
      })
 
      console.log('testing and setting')
      await MODDABLE__STATE_MANAGER.testAndSetAccountLoaded(OVM_SafetyCache.address);
      await MODDABLE__STATE_MANAGER.testAndSetAccountLoaded(MOCK__OVM_DeployerWhitelist.address);
      await MODDABLE__STATE_MANAGER.setExecutionManager(OVM_ExecutionManager.address)
      MODDABLE__STATE_MANAGER.smodify.set({
        owner: gasMeasurement.GasMeasurementContract.address
      }) // @flag: this doesn't seem to actually modify the owner
      console.log('sm-owner ', await MODDABLE__STATE_MANAGER.owner())
    
      // Deploy a simple OVM-safe contract that just deploys another contract
      Helper_SimpleDeployer = await (
        await ethers.getContractFactory('Helper_SimpleOvmDeployer')
      ).deploy()
      DUMMY_TRANSACTION.entrypoint = Helper_SimpleDeployer.address


      MODDABLE__STATE_MANAGER.smodify.set({
        accounts: {
          [Helper_SimpleDeployer.address]: {
            nonce: 0,
            codeHash: NON_NULL_BYTES32,
            ethAddress: Helper_SimpleDeployer.address,
          },
        }
      })
    })

    it('Gas Benchmark: un-chached contract deployment', async () => {
      MODDABLE__STATE_MANAGER.smodify.set({
        ovmExecutionManager: OVM_ExecutionManager.address
      })
      console.log('ovmem', await MODDABLE__STATE_MANAGER.ovmExecutionManager())
      console.log('ovmem', OVM_ExecutionManager.address)
      const gasCost = await gasMeasurement.getGasCost(
        OVM_ExecutionManager,
        'run',
        [DUMMY_TRANSACTION, MODDABLE__STATE_MANAGER.address]
      )
      console.log(`      calculated gas cost of ${gasCost}`)

      const benchmark: number = 3_488_629
      expect(gasCost).to.be.lte(benchmark)
      expect(gasCost).to.be.gte(
        benchmark - 1_000,
        'Gas cost has significantly decreased, consider updating the benchmark to reflect the change'
      )
    })
    
    it('Gas Benchmark: deploying a cached contract', async () => {
      const gasCost = await gasMeasurement.getGasCost(
        OVM_ExecutionManager,
        'run',
        [DUMMY_TRANSACTION, MODDABLE__STATE_MANAGER.address]
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
})
