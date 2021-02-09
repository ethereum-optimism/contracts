import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract, BigNumber } from 'ethers'
import { smockit, MockContract, smoddit, ModifiableContract } from '@eth-optimism/smock'

/* Internal Imports */
import {
  makeAddressManager,
  setProxyTarget,
  NON_NULL_BYTES32,
  ZERO_ADDRESS,
  NON_ZERO_ADDRESS,
  NULL_BYTES32,
  DUMMY_BATCH_HEADERS,
  DUMMY_BATCH_PROOFS,
  TrieTestGenerator,
  toHexString,
  getNextBlockNumber,
  remove0x,
} from '../../../../helpers'
import { getContractInterface } from '../../../../../src'
import { keccak256 } from 'ethers/lib/utils'

const HARDCODED_GASLIMIT = 420069
const decimals = 1 // what to set this to?

describe.only('OVM_L2ERC20Gateway', () => {
  let alice: Signer
  let bob: Signer
  const mockL1ERC20Gateway: string = '0x1234123412341234123412341234123412341234'

  let mockL2CrossDomainMessengerAddress: string
  let Mock__OVM_L2CrossDomainMessenger: MockContract
  let OVM_L2ERC20Gateway: Contract


  describe('finalizeDeposit', () => {
    beforeEach(async () => {
      let signer
      ;[signer, alice, bob] = await ethers.getSigners()
      mockL2CrossDomainMessengerAddress = await signer.getAddress() // though we don't keep track of the signer here, it needs to have come from an ethers signer so that {from: mockL2...} will work.
  
      Mock__OVM_L2CrossDomainMessenger = await smockit(
        await ethers.getContractFactory('OVM_L2CrossDomainMessenger'),
        { address: mockL2CrossDomainMessengerAddress }
      )
      OVM_L2ERC20Gateway = await(
        await ethers.getContractFactory('OVM_L2ERC20Gateway')
      ).deploy(
        Mock__OVM_L2CrossDomainMessenger.address,
        'ovmWETH',
        decimals
      )
  
      await OVM_L2ERC20Gateway.init(mockL1ERC20Gateway)
    })

    it.skip('should revert on calls from a non-crossDomainMessenger L1 account', async () => {
      // TODO
    })

    it.skip('should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender', async () => {
      // TODO, see below for approach, just smock return val to something else
    })

    const depositAmount = 100
    it('should credit funds to the depositor', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(() => mockL1ERC20Gateway)

      await OVM_L2ERC20Gateway.finalizeDeposit(
        await alice.getAddress(),
        depositAmount,
        { from: mockL2CrossDomainMessengerAddress }
      )

      const aliceBalance = await OVM_L2ERC20Gateway.balanceOf(await alice.getAddress())
      aliceBalance.should.equal(depositAmount)
    })
  })

  describe('withdrawals', () => {
    const ALICE_INITIAL_BALANCE = 50_000
    const withdrawAmount = 1_000
    let SmoddedL2Gateway: ModifiableContract
    beforeEach(async () => {
      ;[alice, bob] = await ethers.getSigners()

      Mock__OVM_L2CrossDomainMessenger = await smockit(
        await ethers.getContractFactory('OVM_L2CrossDomainMessenger')
      )
      Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.will.return()

      OVM_L2ERC20Gateway = await(
        await ethers.getContractFactory('OVM_L2ERC20Gateway')
      ).deploy(
        Mock__OVM_L2CrossDomainMessenger.address,
        'ovmWETH',
        decimals
      )
  
      await OVM_L2ERC20Gateway.init(mockL1ERC20Gateway)

      
      SmoddedL2Gateway = await (await smoddit('OVM_L2ERC20Gateway', alice)).deploy(
        Mock__OVM_L2CrossDomainMessenger.address,
        'ovmWETH',
        decimals
      )
      await SmoddedL2Gateway.init(
        mockL1ERC20Gateway
      )

      const aliceAddress = await alice.getAddress()
      SmoddedL2Gateway.smodify.put({
        balances: {
          [aliceAddress] : ALICE_INITIAL_BALANCE
        }
      })
    })


    it('withdraw() burns and sends the correct withdrawal message', async () => { 
      await SmoddedL2Gateway.withdraw(withdrawAmount)
      const withdrawalCallToMessenger = Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // TODO: assert these
      console.log(await SmoddedL2Gateway.balanceOf(await alice.getAddress()))
      console.log(withdrawalCallToMessenger._target)
      console.log(withdrawalCallToMessenger._message)
      console.log(withdrawalCallToMessenger._gasLimit)
    })

    it('withdraw() burns and sends the correct withdrawal message', async () => { 
      await SmoddedL2Gateway.withdrawTo(await bob.getAddress(), withdrawAmount)
      const withdrawalCallToMessenger = Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // TODO: assert these
      console.log(await SmoddedL2Gateway.balanceOf(await alice.getAddress()))
      console.log(withdrawalCallToMessenger._target)
      console.log(withdrawalCallToMessenger._message)
      console.log(withdrawalCallToMessenger._gasLimit)
    })
  })

  // low priority todos: see question in contract
  describe.skip('Initialization logic', () => {

    it('should not allow calls to onlyInitialized functions', async () => {
      // TODO
    })

    it('should only allow initialization once and emits initialized event', async () => {
      // TODO
    })
  })
})
