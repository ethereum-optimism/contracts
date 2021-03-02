import { expect } from '../../../setup'
import { deployContractCode } from '../../../helpers/utils'

/* External Imports */
import { ethers } from 'hardhat'
import { Contract, ContractFactory, Signer, BigNumber } from 'ethers'
import { smoddit, smockit, MockContract } from '@eth-optimism/smock'
import _ from 'lodash'


/* Internal Imports */
import {
  makeAddressManager,
  DUMMY_ACCOUNTS,
  DUMMY_BYTES32,
  ZERO_ADDRESS,
  EMPTY_ACCOUNT_CODE_HASH,
  NON_ZERO_ADDRESS,
  NON_NULL_BYTES32,
  STORAGE_XOR_VALUE,
  setProxyTarget,
  GasMeasurement
} from '../../../helpers'
import { Address } from 'cluster'

const DUMMY_ACCOUNT = DUMMY_ACCOUNTS[0]
const DUMMY_KEY = DUMMY_BYTES32[0]
const DUMMY_VALUE_1 = DUMMY_BYTES32[1]
const DUMMY_VALUE_2 = DUMMY_BYTES32[2]

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
  L1TOL2_QUEUE: 1
}

let DUMMY_TRANSACTION = {
  timestamp: 111111111111,
  blockNumber: 20,
  l1QueueOrigin: QUEUE_ORIGIN.SEQUENCER_QUEUE,
  l1TxOrigin: NON_ZERO_ADDRESS,
  entrypoint: NON_ZERO_ADDRESS, // update this below
  gasLimit: 10_000_000,
  data: 0
}

describe.only('OVM_ExecutionManager gas consumption', () => {
  let wallet: Signer
  before(async () => {
    ;[wallet] = await ethers.getSigners()
  })

  let Factory__OVM_ExecutionManager: ContractFactory
  let MOCK__STATE_MANAGER: MockContract
  let Helper_GasMeasurer: Contract
  let AddressManager: Contract
  let targetContractAddress: string
  let gasMeasurement: GasMeasurement
  before(async () => {
    Factory__OVM_ExecutionManager = await ethers.getContractFactory(
      'OVM_ExecutionManager'
    )
    
    // Deploy a simple contract that just returns successfully with no data
    targetContractAddress = await deployContractCode('60206001f3', wallet, 10_000_000)
    DUMMY_TRANSACTION.entrypoint = targetContractAddress

    AddressManager = await makeAddressManager()

    // deploy the state manager and mock it for the state transitioner
    MOCK__STATE_MANAGER = await smockit(
      await (
        await ethers.getContractFactory('OVM_StateManager')
      ).deploy(NON_ZERO_ADDRESS)
    )
    
    // Setup the SM to satisfy all the checks executed during EM.run()
    MOCK__STATE_MANAGER.smocked.isAuthenticated.will.return.with(true)
    MOCK__STATE_MANAGER.smocked.getAccountEthAddress.will.return.with(targetContractAddress)
    MOCK__STATE_MANAGER.smocked.hasAccount.will.return.with(true)
    MOCK__STATE_MANAGER.smocked.testAndSetAccountLoaded.will.return.with(true)
    
    await AddressManager.setAddress(
      'OVM_StateManagerFactory',
      MOCK__STATE_MANAGER.address
    )

    gasMeasurement = new GasMeasurement()
    await gasMeasurement.init(wallet)
  })


  let OVM_ExecutionManager: Contract
  beforeEach(async () => {
    OVM_ExecutionManager = (
      await Factory__OVM_ExecutionManager.deploy(
        AddressManager.address,
        DUMMY_GASMETERCONFIG,
        DUMMY_GLOBALCONTEXT
      )
    ).connect(wallet)
  })

  describe('Measure cost of a very simple contract', async () => {
    it('Gas cost of run', async () => {
      let gasCost = await gasMeasurement.getGasCost(
        OVM_ExecutionManager, 'run', 
        [DUMMY_TRANSACTION, MOCK__STATE_MANAGER.address]
      )
      console.log(`calculated gas cost of ${gasCost}`)
    })
  })
})