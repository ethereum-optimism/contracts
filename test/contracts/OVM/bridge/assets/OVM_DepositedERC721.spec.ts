import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'

/* Internal Imports */
import { NON_ZERO_ADDRESS, ZERO_ADDRESS } from '../../../../helpers'

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER =
  'OVM_XCHAIN: wrong sender of cross-domain message'
const MOCK_GATEWAY_ADDRESS: string =
  '0x1234123412341234123412341234123412341234'
const ERR_NON_EXISTENT_TOKEN = 'ERC721: owner query for nonexistent token'
const ERR_NOT_YET_INITIALISED = 'Contract has not yet been initialized'
const ERR_ALREADY_INITIALISED = 'Contract has already been initialized'

describe('OVM_DepositedERC721', () => {
  let alice: Signer
  let bob: Signer
  let Factory__OVM_ERC721Gateway: ContractFactory
  before(async () => {
    ;[alice, bob] = await ethers.getSigners()
    Factory__OVM_ERC721Gateway = await ethers.getContractFactory(
      'OVM_ERC721Gateway'
    )
  })

  let OVM_DepositedERC721: Contract
  let Mock__OVM_L2CrossDomainMessenger: MockContract
  let finalizeWithdrawalGasLimit: number
  beforeEach(async () => {
    // Create a special signer which will enable us to send messages from the L2Messenger contract
    let messengerImpersonator: Signer
    ;[messengerImpersonator] = await ethers.getSigners()

    // Get a new mock L2 messenger
    Mock__OVM_L2CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L2CrossDomainMessenger'),
      // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
      { address: await messengerImpersonator.getAddress() }
    )

    // Deploy the contract under test
    OVM_DepositedERC721 = await (
      await ethers.getContractFactory('OVM_DepositedERC721')
    ).deploy(Mock__OVM_L2CrossDomainMessenger.address, 'OptimisticPunks', 'OP')

    // initialize the L2 Gateway with the L1G ateway addrss
    await OVM_DepositedERC721.init(MOCK_GATEWAY_ADDRESS)

    finalizeWithdrawalGasLimit = await OVM_DepositedERC721.getFinalizeWithdrawalGas()
  })

  // test the transfer flow of moving a token from L2 to L1
  describe('finalizeDeposit', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger account', async () => {
      // Deploy new gateway, initialize with random messenger
      OVM_DepositedERC721 = await (
        await ethers.getContractFactory('OVM_DepositedERC721')
      ).deploy(NON_ZERO_ADDRESS, 'OptimisticPunks', 'OP')
      await OVM_DepositedERC721.init(NON_ZERO_ADDRESS)

      await expect(
        OVM_DepositedERC721.finalizeDeposit(ZERO_ADDRESS, 0, 'abc')
      ).to.be.revertedWith(ERR_INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ERC20Gateway)', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        NON_ZERO_ADDRESS
      )

      await expect(
        OVM_DepositedERC721.finalizeDeposit(ZERO_ADDRESS, 0, {
          from: Mock__OVM_L2CrossDomainMessenger.address,
        })
      ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should mint the specified token to the depositor', async () => {
      const depositToken = 123
      const depositTokenURI = 'test-token-uri'
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => MOCK_GATEWAY_ADDRESS
      )

      await OVM_DepositedERC721.finalizeDeposit(
        await alice.getAddress(),
        depositToken,
        depositTokenURI,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )

      const aliceBalance = await OVM_DepositedERC721.balanceOf(
        await alice.getAddress()
      )
      aliceBalance.should.equal(1)

      // Assert that Alice is now the owner of the deposited token
      const tokenOwner = await OVM_DepositedERC721.ownerOf(depositToken)
      tokenOwner.should.equal(await alice.getAddress())

      // Assert that deposited token has URI set
      const tokenURI = await OVM_DepositedERC721.tokenURI(depositToken)
      tokenURI.should.equal(depositTokenURI)
    })
  })

  describe('withdrawals', () => {
    //const ALICE_INITIAL_BALANCE = 2
    const depositToken = 123
    const depositTokenURI = 'test-token-uri'

    beforeEach(async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => MOCK_GATEWAY_ADDRESS
      )

      await OVM_DepositedERC721.finalizeDeposit(
        await alice.getAddress(),
        depositToken,
        depositTokenURI,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )
    })

    it('withdraw() burns and sends the correct withdrawal message', async () => {
      await OVM_DepositedERC721.withdraw(depositToken)
      const withdrawalCallToMessenger =
        Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert Alice's balance went down
      const aliceBalance = await OVM_DepositedERC721.balanceOf(
        await alice.getAddress()
      )
      expect(aliceBalance).to.deep.equal(ethers.BigNumber.from(0))

      // Assert that the withdrawn token no longer exists
      await expect(
        OVM_DepositedERC721.ownerOf(depositToken)
      ).to.be.revertedWith(ERR_NON_EXISTENT_TOKEN)

      // Assert the correct cross-chain call was sent:
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(MOCK_GATEWAY_ADDRESS)
      // Message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        await Factory__OVM_ERC721Gateway.interface.encodeFunctionData(
          'finalizeWithdrawal',
          [await alice.getAddress(), depositToken]
        )
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(
        finalizeWithdrawalGasLimit
      )
    })

    it('withdrawTo() burns and sends the correct withdrawal message', async () => {
      await OVM_DepositedERC721.withdrawTo(await bob.getAddress(), depositToken)
      const withdrawalCallToMessenger =
        Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert Alice's balance went down
      const aliceBalance = await OVM_DepositedERC721.balanceOf(
        await alice.getAddress()
      )
      expect(aliceBalance).to.deep.equal(ethers.BigNumber.from(0))

      // Assert that the withdrawn token no longer exists
      await expect(
        OVM_DepositedERC721.ownerOf(depositToken)
      ).to.be.revertedWith(ERR_NON_EXISTENT_TOKEN)

      // Assert the correct cross-chain call was sent:
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(MOCK_GATEWAY_ADDRESS)
      // Message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        await Factory__OVM_ERC721Gateway.interface.encodeFunctionData(
          'finalizeWithdrawal',
          [await bob.getAddress(), depositToken]
        )
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(
        finalizeWithdrawalGasLimit
      )
    })
  })

  describe('Initialization logic', () => {
    it('should not allow calls to onlyInitialized functions', async () => {
      OVM_DepositedERC721 = await (
        await ethers.getContractFactory('OVM_DepositedERC721')
      ).deploy(NON_ZERO_ADDRESS, 'OptimisticPunks', 'OP')

      await expect(
        OVM_DepositedERC721.finalizeDeposit(ZERO_ADDRESS, 0, 'abc')
      ).to.be.revertedWith(ERR_NOT_YET_INITIALISED)
    })

    it('should only allow initialization once and emits initialized event', async () => {
      OVM_DepositedERC721 = await (
        await ethers.getContractFactory('OVM_DepositedERC721')
      ).deploy(NON_ZERO_ADDRESS, 'OptimisticPunks', 'OP')
      await expect(OVM_DepositedERC721.init(NON_ZERO_ADDRESS)).to.emit(
        OVM_DepositedERC721,
        'Initialized'
      )

      await expect(OVM_DepositedERC721.init(ZERO_ADDRESS)).to.be.revertedWith(
        ERR_ALREADY_INITIALISED
      )
    })
  })
})
