import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, Contract, constants } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'

/* Internal Imports */
import { NON_ZERO_ADDRESS, makeAddressManager } from '../../../../helpers'

const L1_ETH_GATEWAY_NAME = 'Proxy__OVM_L1CrossDomainMessenger'

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER =
  'OVM_XCHAIN: wrong sender of cross-domain message'

describe('OVM_L1ETHGateway', () => {
  // init signers
  let l1MessengerImpersonator: Signer
  let alice: Signer
  let bob: Signer

  let AddressManager: Contract
  before(async () => {
    AddressManager = await makeAddressManager()
  })

  // we can just make up this string since it's on the "other" Layer
  let Mock__OVM_L2DepositedERC20: MockContract
  before(async () => {
    ;[l1MessengerImpersonator, alice, bob] = await ethers.getSigners()

    Mock__OVM_L2DepositedERC20 = await smockit(
      await ethers.getContractFactory('OVM_L2DepositedERC20')
    )
  })

  let OVM_L1ETHGateway: Contract
  let Mock__OVM_L1CrossDomainMessenger: MockContract
  let finalizeDepositGasLimit: number
  beforeEach(async () => {
    // Get a new mock L1 messenger
    Mock__OVM_L1CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L1CrossDomainMessenger'),
      { address: await l1MessengerImpersonator.getAddress() } // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
    )

    // Deploy the contract under test
    OVM_L1ETHGateway = await (
      await ethers.getContractFactory('OVM_L1ETHGateway')
    ).deploy(AddressManager.address, Mock__OVM_L2DepositedERC20.address)

    finalizeDepositGasLimit = await OVM_L1ETHGateway.getFinalizeDepositL2Gas()
  })

  describe('finalizeWithdrawal', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L1 account', async () => {
      // Deploy new gateway, initialize with random messenger
      await expect(
        OVM_L1ETHGateway.connect(alice).finalizeWithdrawal(
          constants.AddressZero,
          1
        )
      ).to.be.revertedWith(ERR_INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L2ETHGateway)', async () => {
      await AddressManager.setAddress(
        L1_ETH_GATEWAY_NAME,
        Mock__OVM_L1CrossDomainMessenger.address
      )

      OVM_L1ETHGateway = await (
        await ethers.getContractFactory('OVM_L1ETHGateway')
      ).deploy(AddressManager.address, Mock__OVM_L2DepositedERC20.address)

      Mock__OVM_L1CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        NON_ZERO_ADDRESS
      )

      await expect(
        OVM_L1ETHGateway.finalizeWithdrawal(constants.AddressZero, 1)
      ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should credit funds to the withdrawer and not use too much gas', async () => {
      // make sure no balance at start of test
      await expect(
        await ethers.provider.getBalance(NON_ZERO_ADDRESS)
      ).to.be.equal(0)

      const withdrawalAmount = 100
      Mock__OVM_L1CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => Mock__OVM_L2DepositedERC20.address
      )

      // thanks Alice
      await OVM_L1ETHGateway.connect(alice).deposit({
        value: ethers.utils.parseEther('1.0'),
        gasPrice: 0,
      })

      const res = await OVM_L1ETHGateway.finalizeWithdrawal(
        NON_ZERO_ADDRESS,
        withdrawalAmount,
        { from: Mock__OVM_L1CrossDomainMessenger.address }
      )

      await expect(
        await ethers.provider.getBalance(NON_ZERO_ADDRESS)
      ).to.be.equal(withdrawalAmount)

      const gasUsed = (
        await OVM_L1ETHGateway.provider.getTransactionReceipt(res.hash)
      ).gasUsed

      // Deploy this just for the getter
      const OVM_L2DepositedERC20 = await (
        await ethers.getContractFactory('OVM_L2DepositedERC20')
      ).deploy(constants.AddressZero, '', '')

      await expect(
        gasUsed.gt(
          ((await OVM_L2DepositedERC20.getFinalizeWithdrawalL1Gas()) * 11) / 10
        )
      )
    })

    it.skip('finalizeWithdrawalAndCall(): should should credit funds to the withdrawer, and forward from and data', async () => {
      // TODO: implement this functionality in a future update
      expect.fail()
    })
  })

  describe('deposits', () => {
    const depositAmount = 1_000

    beforeEach(async () => {
      // Deploy the L1 ETH token, Alice will receive the full initialSupply

      // get a new mock L1 messenger and set in AM
      Mock__OVM_L1CrossDomainMessenger = await smockit(
        await ethers.getContractFactory('OVM_L1CrossDomainMessenger')
      )
      await AddressManager.setAddress(
        L1_ETH_GATEWAY_NAME,
        Mock__OVM_L1CrossDomainMessenger.address
      )

      // Deploy the contract under test:
      OVM_L1ETHGateway = await (
        await ethers.getContractFactory('OVM_L1ETHGateway')
      ).deploy(AddressManager.address, Mock__OVM_L2DepositedERC20.address)
    })

    it('deposit() escrows the deposit amount and sends the correct deposit message', async () => {
      const depositer = await alice.getAddress()
      const initialBalance = await ethers.provider.getBalance(depositer)

      // alice calls deposit on the gateway and the L1 gateway calls transferFrom on the token
      await OVM_L1ETHGateway.connect(alice).deposit({
        value: depositAmount,
        gasPrice: 0,
      })

      const depositCallToMessenger =
        Mock__OVM_L1CrossDomainMessenger.smocked.sendMessage.calls[0]

      const depositerBalance = await ethers.provider.getBalance(depositer)

      expect(depositerBalance).to.equal(initialBalance.sub(depositAmount))

      // gateway's balance is increased
      const gatewayBalance = await ethers.provider.getBalance(
        OVM_L1ETHGateway.address
      )
      expect(gatewayBalance).to.equal(depositAmount)

      // Check the correct cross-chain call was sent:
      // Message should be sent to the L2ETHGateway on L2
      expect(depositCallToMessenger._target).to.equal(
        Mock__OVM_L2DepositedERC20.address
      )
      // Message data should be a call telling the L2ETHGateway to finalize the deposit

      // the L1 gateway sends the correct message to the L1 messenger
      expect(depositCallToMessenger._message).to.equal(
        await Mock__OVM_L2DepositedERC20.interface.encodeFunctionData(
          'finalizeDeposit',
          [depositer, depositAmount]
        )
      )
      expect(depositCallToMessenger._gasLimit).to.equal(finalizeDepositGasLimit)
    })

    it('depositTo() escrows the deposit amount and sends the correct deposit message', async () => {
      // depositor calls deposit on the gateway and the L1 gateway calls transferFrom on the token
      const bobsAddress = await bob.getAddress()
      const aliceAddress = await alice.getAddress()
      const initialBalance = await ethers.provider.getBalance(aliceAddress)

      await OVM_L1ETHGateway.connect(alice).depositTo(bobsAddress, {
        value: depositAmount,
        gasPrice: 0,
      })
      const depositCallToMessenger =
        Mock__OVM_L1CrossDomainMessenger.smocked.sendMessage.calls[0]

      const depositerBalance = await ethers.provider.getBalance(aliceAddress)
      expect(depositerBalance).to.equal(initialBalance.sub(depositAmount))

      // gateway's balance is increased
      const gatewayBalance = await ethers.provider.getBalance(
        OVM_L1ETHGateway.address
      )
      expect(gatewayBalance).to.equal(depositAmount)

      // Check the correct cross-chain call was sent:
      // Message should be sent to the L2ETHGateway on L2
      expect(depositCallToMessenger._target).to.equal(
        Mock__OVM_L2DepositedERC20.address
      )
      // Message data should be a call telling the L2ETHGateway to finalize the deposit

      // the L1 gateway sends the correct message to the L1 messenger
      expect(depositCallToMessenger._message).to.equal(
        await Mock__OVM_L2DepositedERC20.interface.encodeFunctionData(
          'finalizeDeposit',
          [bobsAddress, depositAmount]
        )
      )
      expect(depositCallToMessenger._gasLimit).to.equal(finalizeDepositGasLimit)
    })
  })
})
