import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract, BigNumber } from 'ethers'
import { smockit, MockContract, smoddit, ModifiableContract } from '@eth-optimism/smock'

/* Internal Imports */
import {
  getXDomainCalldata
} from '../../../../helpers'
import { getContractInterface } from '../../../../../src'
import { keccak256 } from 'ethers/lib/utils'

const HARDCODED_GASLIMIT = 420069
const decimals = 1 // what to set this to?

describe.only('OVM_L2ERC20Gateway', () => {
  let alice: Signer
  let bob: Signer
  const mockL1ERC20Gateway: string = '0x1234123412341234123412341234123412341234'

  let Factory__OVM_L1ERC20Gateway: ContractFactory
  before(async () => {
    Factory__OVM_L1ERC20Gateway = await ethers.getContractFactory('OVM_L1ERC20Gateway')
  })

  let mockL2CrossDomainMessengerAddress: string
  let Mock__OVM_L2CrossDomainMessenger: MockContract
  let OVM_L2ERC20Gateway: Contract
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


  describe('finalizeDeposit', () => {
    

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
    const INITIAL_TOTAL_SUPPLY = 100_000
    const ALICE_INITIAL_BALANCE = 50_000
    const withdrawAmount = 1_000
    let SmoddedL2Gateway: ModifiableContract
    beforeEach(async () => {
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
        totalSupply: INITIAL_TOTAL_SUPPLY,
        balances: {
          [aliceAddress] : ALICE_INITIAL_BALANCE
        }
      })
    })

    it('withdraw() burns and sends the correct withdrawal message', async () => { 
      await SmoddedL2Gateway.withdraw(withdrawAmount)
      const withdrawalCallToMessenger = Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert Alice's balance went down
      const aliceBalance = await SmoddedL2Gateway.balanceOf(await alice.getAddress())
      expect(aliceBalance).to.deep.equal(ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount))
      
      // Assert totalSupply went down
      const newTotalSupply = await SmoddedL2Gateway.totalSupply()
      expect(newTotalSupply).to.deep.equal(ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount))

      // Assert the correct cross-chain call was sent.
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(mockL1ERC20Gateway)
      // The message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        await Factory__OVM_L1ERC20Gateway.interface.encodeFunctionData(
          'finalizeWithdrawal',
          [await alice.getAddress(), withdrawAmount]
        )
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(HARDCODED_GASLIMIT)
    })

    it('withdraw() burns and sends the correct withdrawal message', async () => { 
      await SmoddedL2Gateway.withdrawTo(await bob.getAddress(), withdrawAmount)
      const withdrawalCallToMessenger = Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert Alice's balance went down
      const aliceBalance = await SmoddedL2Gateway.balanceOf(await alice.getAddress())
      expect(aliceBalance).to.deep.equal(ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount))
      
      // Assert totalSupply went down
      const newTotalSupply = await SmoddedL2Gateway.totalSupply()
      expect(newTotalSupply).to.deep.equal(ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount))

      // Assert the correct cross-chain call was sent.
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(mockL1ERC20Gateway)
      // The message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        await Factory__OVM_L1ERC20Gateway.interface.encodeFunctionData(
          'finalizeWithdrawal',
          [await bob.getAddress(), withdrawAmount]
        )
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(HARDCODED_GASLIMIT)
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
