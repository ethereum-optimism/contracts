import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract } from 'ethers'
import { smockit, MockContract, smoddit } from '@eth-optimism/smock'

/* Internal Imports */
import { NON_ZERO_ADDRESS, ZERO_ADDRESS } from '../../../../helpers'

const TEST_TOKEN_URI = 'test-uri-goes-here'

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER =
  'OVM_XCHAIN: wrong sender of cross-domain message'

describe('OVM_ERC721Gateway', () => {
  // init signers
  let alice: Signer

  // we can just make up this string since it's on the "other" Layer
  let Mock__OVM_DepositedERC721: MockContract
  let Factory__ERC721: ContractFactory
  let ERC721: Contract
  before(async () => {
    Mock__OVM_DepositedERC721 = await smockit(
      await ethers.getContractFactory('OVM_DepositedERC721')
    )

    // deploy an ERC20 contract on L1
    Factory__ERC721 = await smoddit('TestERC721')

    ERC721 = await Factory__ERC721.deploy('TestERC721', 'ERC')
  })

  let OVM_ERC721Gateway: Contract
  let Mock__OVM_L1CrossDomainMessenger: MockContract
  let finalizeDepositGasLimit: number
  beforeEach(async () => {
    // Create a special signer which will enable us to send messages from the L1Messenger contract
    let l1MessengerImpersonator: Signer
    ;[l1MessengerImpersonator, alice] = await ethers.getSigners()
    // Get a new mock L1 messenger
    Mock__OVM_L1CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L1CrossDomainMessenger'),
      { address: await l1MessengerImpersonator.getAddress() } // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
    )

    // Deploy the contract under test
    OVM_ERC721Gateway = await (
      await ethers.getContractFactory('OVM_ERC721Gateway')
    ).deploy(
      ERC721.address,
      Mock__OVM_DepositedERC721.address,
      Mock__OVM_L1CrossDomainMessenger.address
    )

    finalizeDepositGasLimit = await OVM_ERC721Gateway.DEFAULT_FINALIZE_DEPOSIT_GAS()
  })

  describe('finalizeWithdrawal', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L1 account', async () => {
      // Deploy new gateway, initialize with random messenger
      OVM_ERC721Gateway = await (
        await ethers.getContractFactory('OVM_ERC721Gateway')
      ).deploy(
        ERC721.address,
        Mock__OVM_DepositedERC721.address,
        NON_ZERO_ADDRESS
      )

      await expect(
        OVM_ERC721Gateway.finalizeWithdrawal(ZERO_ADDRESS, 1)
      ).to.be.revertedWith(ERR_INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L2ERC20Gateway)', async () => {
      Mock__OVM_L1CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => NON_ZERO_ADDRESS
      )

      await expect(
        OVM_ERC721Gateway.finalizeWithdrawal(ZERO_ADDRESS, 1, {
          from: Mock__OVM_L1CrossDomainMessenger.address,
        })
      ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should credit funds to the withdrawer and not use too much gas', async () => {
      // make sure no balance at start of test
      await expect(await ERC721.balanceOf(NON_ZERO_ADDRESS)).to.be.equal(0)

      Mock__OVM_L1CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => Mock__OVM_DepositedERC721.address
      )

      const testTokenId = 123
      ERC721.mint(OVM_ERC721Gateway.address, testTokenId, TEST_TOKEN_URI)

      const res = await OVM_ERC721Gateway.finalizeWithdrawal(
        NON_ZERO_ADDRESS,
        testTokenId,
        { from: Mock__OVM_L1CrossDomainMessenger.address }
      )

      await expect(await ERC721.ownerOf(testTokenId)).to.be.equal(
        NON_ZERO_ADDRESS
      )

      const gasUsed = (
        await OVM_ERC721Gateway.provider.getTransactionReceipt(res.hash)
      ).gasUsed

      const OVM_DepositedERC721 = await (
        await ethers.getContractFactory('OVM_DepositedERC721')
      ).deploy(ZERO_ADDRESS, '', '')
      const defaultFinalizeWithdrawalGas = await OVM_DepositedERC721.getFinalizeWithdrawalGas()
      await expect(gasUsed.gt((defaultFinalizeWithdrawalGas * 11) / 10))
    })

    it.skip('finalizeWithdrawalAndCall(): should should credit funds to the withdrawer, and forward from and data', async () => {
      // TODO: implement this functionality in a future update
      expect.fail()
    })
  })

  describe('deposits', () => {
    let depositer: string
    const depositTokenId = 321

    beforeEach(async () => {
      // Deploy the L1 ERC20 token, Alice will receive the full initialSupply
      ERC721 = await Factory__ERC721.deploy('TestERC721', 'ERC')

      // get a new mock L1 messenger
      Mock__OVM_L1CrossDomainMessenger = await smockit(
        await ethers.getContractFactory('OVM_L1CrossDomainMessenger')
      )

      // Deploy the contract under test:
      OVM_ERC721Gateway = await (
        await ethers.getContractFactory('OVM_ERC721Gateway')
      ).deploy(
        ERC721.address,
        Mock__OVM_DepositedERC721.address,
        Mock__OVM_L1CrossDomainMessenger.address
      )

      depositer = await ERC721.signer.getAddress()

      await ERC721.mint(depositer, depositTokenId, TEST_TOKEN_URI)

      // the Signer sets approve for the L1 Gateway
      await ERC721.approve(OVM_ERC721Gateway.address, depositTokenId)
    })

    it('deposit() escrows the deposit token and sends the correct deposit message', async () => {
      // expect depositer to be initial owner
      const initialTokenOwner = await ERC721.ownerOf(depositTokenId)
      expect(initialTokenOwner).to.equal(depositer)

      // depositer calls deposit on the gateway and the gateway calls transferFrom on the token
      await OVM_ERC721Gateway.deposit(depositTokenId)
      const depositCallToMessenger =
        Mock__OVM_L1CrossDomainMessenger.smocked.sendMessage.calls[0]

      // expect the gateway to be the new owner of the token
      const newTokenOwner = await ERC721.ownerOf(depositTokenId)
      expect(newTokenOwner).to.equal(OVM_ERC721Gateway.address)

      // Check the correct cross-chain call was sent:
      // Message should be sent to the L2ERC20Gateway on L2
      expect(depositCallToMessenger._target).to.equal(
        Mock__OVM_DepositedERC721.address
      )
      // Message data should be a call telling the L2ERC20Gateway to finalize the deposit

      // the L1 gateway sends the correct message to the L1 messenger, including TokenURI
      expect(depositCallToMessenger._message).to.equal(
        await Mock__OVM_DepositedERC721.interface.encodeFunctionData(
          'finalizeDeposit',
          [depositer, depositTokenId, TEST_TOKEN_URI]
        )
      )
      expect(depositCallToMessenger._gasLimit).to.equal(finalizeDepositGasLimit)
    })

    it('depositTo() escrows the deposit token and sends the correct deposit message', async () => {
      // depositor calls deposit on the gateway and the L1 gateway calls transferFrom on the token
      const aliceAddress = await alice.getAddress()

      // depositer calls deposit on the gateway and the gateway calls transferFrom on the token
      await OVM_ERC721Gateway.depositTo(aliceAddress, depositTokenId)
      const depositCallToMessenger =
        Mock__OVM_L1CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Message data should be a call telling the L2ERC20Gateway to finalize the deposit
      // the L1 gateway sends the correct message to the L1 messenger, including TokenURI
      expect(depositCallToMessenger._message).to.equal(
        await Mock__OVM_DepositedERC721.interface.encodeFunctionData(
          'finalizeDeposit',
          [aliceAddress, depositTokenId, TEST_TOKEN_URI]
        )
      )
    })

    it('safeTransfer of a token to the gateway escrows it and initiates a deposit', async () => {
      const initialTokenOwner = await ERC721.ownerOf(depositTokenId)

      // depositer safeTransfers a token to the gateway, which leads to a call onERC721Received which initiates a deposit
      await expect(ERC721['safeTransferFrom(address,address,uint256)'](initialTokenOwner, OVM_ERC721Gateway.address, depositTokenId)).to.emit(
        OVM_ERC721Gateway,
        'DepositInitiated'
      )

      // expect the gateway to be the new owner of the token
      const newTokenOwner = await ERC721.ownerOf(depositTokenId)
      expect(newTokenOwner).to.equal(OVM_ERC721Gateway.address)

    })
  })
})
