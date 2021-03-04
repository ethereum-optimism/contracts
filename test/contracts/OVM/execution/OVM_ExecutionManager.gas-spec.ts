import { expect } from '../../../setup'
import { deployContractCode } from '../../../helpers/utils'

/* External Imports */
import { ethers } from 'hardhat'
import { Contract, ContractFactory, Signer } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'

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

describe.only('OVM_ExecutionManager gas consumption', () => {
  let wallet: Signer
  let MOCK__STATE_MANAGER: MockContract
  let AddressManager: Contract
  let gasMeasurement: GasMeasurement
  let Factory__OVM_ExecutionManager: ContractFactory
  let OVM_ExecutionManager: Contract
  before(async () => {
    ;[wallet] = await ethers.getSigners()

    AddressManager = await makeAddressManager()

    // deploy the state manager and mock it for the state transitioner
    MOCK__STATE_MANAGER = await smockit(
      await (await ethers.getContractFactory('OVM_StateManager')).deploy(
        NON_ZERO_ADDRESS
      )
    )

    // Setup the SM to satisfy all the checks executed during EM.run()
    MOCK__STATE_MANAGER.smocked.isAuthenticated.will.return.with(true)
    MOCK__STATE_MANAGER.smocked.hasAccount.will.return.with(true)
    MOCK__STATE_MANAGER.smocked.testAndSetAccountLoaded.will.return.with(true)

    await AddressManager.setAddress(
      'OVM_StateManagerFactory',
      MOCK__STATE_MANAGER.address
    )

    // Setup the EM
    Factory__OVM_ExecutionManager = await ethers.getContractFactory(
      'OVM_ExecutionManager'
    )
    OVM_ExecutionManager = (
      await Factory__OVM_ExecutionManager.deploy(
        AddressManager.address,
        DUMMY_GASMETERCONFIG,
        DUMMY_GLOBALCONTEXT
      )
    ).connect(wallet)

    // Deploy GasMeasurement utility
    gasMeasurement = new GasMeasurement()
    await gasMeasurement.init(wallet)
  })

  describe('Measure cost of executing a very simple contract', async () => {

    let targetContractAddress: string
    before(async () => {
      // Deploy a simple OVM-safe contract which is just `STOP`
      targetContractAddress = await deployContractCode(
        '00',
        wallet,
        10_000_000
      )
      DUMMY_TRANSACTION.entrypoint = targetContractAddress
      MOCK__STATE_MANAGER.smocked.getAccountEthAddress.will.return.with(
        targetContractAddress
      )
    })

    it('Gas benchmark: cost of run()', async () => {
      // by setting the entrypoint to our minimal contract, and smocking the SM
      // we measure mostly the overhead of EM.run()
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

  describe('Measure cost of deploying a simple contract', async () => {
    let simpleDeployer: Contract
    before(async () => {
      // Deploy a simple OVM-safe contract that just deploys a another contract
      simpleDeployer = await (
        await ethers.getContractFactory('Helper_SimpleOvmDeployer')
      ).deploy()
      DUMMY_TRANSACTION.entrypoint = simpleDeployer.address

      MOCK__STATE_MANAGER.smocked.getAccountEthAddress.will.return.with(
        simpleDeployer.address
      )
    })

    it('Benchmark un-chached contract deployment', async () => {
      const gasCost = await gasMeasurement.getGasCost(
        OVM_ExecutionManager,
        'run',
        [DUMMY_TRANSACTION, MOCK__STATE_MANAGER.address]
      )
      console.log(`      calculated gas cost of ${gasCost}`)

      const benchmark: number = 3_488_629
      expect(gasCost).to.be.lte(benchmark)
      expect(gasCost).to.be.gte(
        benchmark - 1_000,
        'Gas cost has significantly decreased, consider updating the benchmark to reflect the change'
      )
    })
    
    it('Gas benchmark: deploying a cached contract', async () => {
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
  describe.skip('Measure cost of deploying a larger contract', async () => {
    it('Benchmark un-chached contract deployment', async () => {
    })
    it('Gas benchmark: deploying a cached contract', async () => {
    })
  })
})
