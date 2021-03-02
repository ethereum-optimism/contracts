import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract, BigNumber } from 'ethers'
import {
  smockit,
  MockContract,
  smoddit,
  ModifiableContract,
} from '@eth-optimism/smock'

/* Internal Imports */
import { NON_ZERO_ADDRESS, ZERO_ADDRESS } from '../../../../helpers'

const decimals = 1

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER =
  'OVM_XCHAIN: wrong sender of cross-domain message'
const MOCK_L1GATEWAY_ADDRESS: string =
  '0x1234123412341234123412341234123412341234'
const MOCK_L1ERC20_ADDRESS = '0x4242424242424242424242424242424242424242'

describe('OVM_L2TokenBridge', () => {
  let alice: Signer
  let bob: Signer
  let Factory__OVM_L1TokenBridge: ContractFactory
  let Factory__OVM_L2ERC20: ContractFactory
  let Factory__OVM_L2ERC777: ContractFactory
  before(async () => {
    ;[alice, bob] = await ethers.getSigners()
    Factory__OVM_L1TokenBridge = await ethers.getContractFactory('OVM_L1TokenBridge')
    Factory__OVM_L2ERC777 = await ethers.getContractFactory('OVM_L2ERC777')
    Factory__OVM_L2ERC20 = await ethers.getContractFactory('OVM_L2ERC20')
  })

  let OVM_L2TokenBridge: Contract
  let Mock__OVM_L2CrossDomainMessenger: MockContract
  let finalizeWithdrawalGasLimit: number
  beforeEach(async () => {
    // Create a special signer which will enable us to send messages from the L2Messenger contract
    let l2MessengerImpersonator: Signer
    ;[l2MessengerImpersonator] = await ethers.getSigners()

    // Get a new mock L2 messenger
    Mock__OVM_L2CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L2CrossDomainMessenger'),
      // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
      { address: await l2MessengerImpersonator.getAddress() }
    )

    // Deploy the contract under test
    OVM_L2TokenBridge = await (
      await ethers.getContractFactory('OVM_L2TokenBridge')
    ).deploy(Mock__OVM_L2CrossDomainMessenger.address)

    // initialize the L2 Gateway with the L1G ateway addrss
    await OVM_L2TokenBridge.init(MOCK_L1GATEWAY_ADDRESS)

    finalizeWithdrawalGasLimit = await OVM_L2TokenBridge.DEFAULT_FINALIZE_WITHDRAWAL_L1_GAS()
  })

  describe('deposits', () => {
    describe('ERC777', () => {
      it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L2 account', async () => {
        // Deploy new gateway, initialize with random messenger
        OVM_L2TokenBridge = await (
          await ethers.getContractFactory('OVM_L2TokenBridge')
        ).deploy(NON_ZERO_ADDRESS)
        await OVM_L2TokenBridge.init(NON_ZERO_ADDRESS)

        await expect(
          OVM_L2TokenBridge.depositAsERC777(MOCK_L1ERC20_ADDRESS, NON_ZERO_ADDRESS, 1000, 18)
        ).to.be.revertedWith(ERR_INVALID_MESSENGER)
      })

      it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ERC20Gateway)', async () => {
        Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
          NON_ZERO_ADDRESS
        )

        await expect(
          OVM_L2TokenBridge.depositAsERC777(MOCK_L1ERC20_ADDRESS, NON_ZERO_ADDRESS, 1000, 18, {
            from: Mock__OVM_L2CrossDomainMessenger.address,
          })
        ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
      })

      it('should create an ERC777 token on L2 and deposit funds', async () => {
        Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
          () => MOCK_L1GATEWAY_ADDRESS
        )

        await OVM_L2TokenBridge.depositAsERC777(
          MOCK_L1ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          100,
          18,
          { from: Mock__OVM_L2CrossDomainMessenger.address }
        )

        const L2ERC20Token = await Factory__OVM_L2ERC777.attach(
          await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)
        )

        expect(await L2ERC20Token.balanceOf(NON_ZERO_ADDRESS)).to.equal(100)
        expect(await L2ERC20Token.totalSupply()).to.equal(100)

        await OVM_L2TokenBridge.depositAsERC777(
          MOCK_L1ERC20_ADDRESS,
          await bob.getAddress(),
          100,
          18,
          { from: Mock__OVM_L2CrossDomainMessenger.address }
        )

        expect(await L2ERC20Token.balanceOf(await bob.getAddress())).to.equal(100)
        expect(await L2ERC20Token.totalSupply()).to.equal(200)
      })

      it('should convert values for tokens with less than 18 decimals', async () => {
        Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
          () => MOCK_L1GATEWAY_ADDRESS
        )

        await OVM_L2TokenBridge.depositAsERC777(
          MOCK_L1ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          100,
          16,
          { from: Mock__OVM_L2CrossDomainMessenger.address }
        )

        const L2ERC20Token = await Factory__OVM_L2ERC777.attach(
          await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)
        )

        expect(await L2ERC20Token.decimals()).to.equal(18)
        expect(await L2ERC20Token.granularity()).to.equal(100)
        expect(await L2ERC20Token.balanceOf(NON_ZERO_ADDRESS)).to.equal(10000)
        expect(await L2ERC20Token.totalSupply()).to.equal(10000)
      })
    })

    describe('ERC20', () => {
      it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L2 account', async () => {
        // Deploy new gateway, initialize with random messenger
        OVM_L2TokenBridge = await (
          await ethers.getContractFactory('OVM_L2TokenBridge')
        ).deploy(NON_ZERO_ADDRESS)
        await OVM_L2TokenBridge.init(NON_ZERO_ADDRESS)

        await expect(
          OVM_L2TokenBridge.depositAsERC777(MOCK_L1ERC20_ADDRESS, NON_ZERO_ADDRESS, 1000, 18)
        ).to.be.revertedWith(ERR_INVALID_MESSENGER)
      })

      it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ERC20Gateway)', async () => {
        Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
          NON_ZERO_ADDRESS
        )

        await expect(
          OVM_L2TokenBridge.depositAsERC777(MOCK_L1ERC20_ADDRESS, NON_ZERO_ADDRESS, 1000, 18, {
            from: Mock__OVM_L2CrossDomainMessenger.address,
          })
        ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
      })

      it('should create an ERC777 token on L2 and deposit funds', async () => {
        Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
          () => MOCK_L1GATEWAY_ADDRESS
        )

        await OVM_L2TokenBridge.depositAsERC20(
          MOCK_L1ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          100,
          18,
          { from: Mock__OVM_L2CrossDomainMessenger.address }
        )

        const L2ERC20Token = await Factory__OVM_L2ERC20.attach(
          await OVM_L2TokenBridge.calculateL2ERC20Address(MOCK_L1ERC20_ADDRESS)
        )

        expect(await L2ERC20Token.balanceOf(NON_ZERO_ADDRESS)).to.equal(100)
        expect(await L2ERC20Token.totalSupply()).to.equal(100)

        await OVM_L2TokenBridge.depositAsERC20(
          MOCK_L1ERC20_ADDRESS,
          await bob.getAddress(),
          100,
          18,
          { from: Mock__OVM_L2CrossDomainMessenger.address }
        )

        expect(await L2ERC20Token.balanceOf(await bob.getAddress())).to.equal(100)
        expect(await L2ERC20Token.totalSupply()).to.equal(200)
      })
    })
  })

  describe('updateTokenInfo', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L2 account', async () => {
      // Deploy new gateway, initialize with random messenger
      OVM_L2TokenBridge = await (
        await ethers.getContractFactory('OVM_L2TokenBridge')
      ).deploy(NON_ZERO_ADDRESS)
      await OVM_L2TokenBridge.init(NON_ZERO_ADDRESS)

      await expect(
        OVM_L2TokenBridge.updateTokenInfo(MOCK_L1ERC20_ADDRESS, 'Test Token', 'TEST')
      ).to.be.revertedWith(ERR_INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ERC20Gateway)', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        NON_ZERO_ADDRESS
      )

      await expect(
        OVM_L2TokenBridge.updateTokenInfo(MOCK_L1ERC20_ADDRESS, 'Test Token', 'TEST', {
          from: Mock__OVM_L2CrossDomainMessenger.address,
        })
      ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should update the ERC777 & ERC20 token info', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => MOCK_L1GATEWAY_ADDRESS
      )

      await OVM_L2TokenBridge.depositAsERC20(
        MOCK_L1ERC20_ADDRESS,
        NON_ZERO_ADDRESS,
        100,
        18,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )
      await OVM_L2TokenBridge.depositAsERC777(
        MOCK_L1ERC20_ADDRESS,
        NON_ZERO_ADDRESS,
        100,
        18,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )

      const L2ERC777Token = await Factory__OVM_L2ERC777.attach(
        await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)
      )
      const L2ERC20Token = await Factory__OVM_L2ERC20.attach(
        await OVM_L2TokenBridge.calculateL2ERC20Address(MOCK_L1ERC20_ADDRESS)
      )
      expect(await L2ERC20Token.name()).to.equal('')
      expect(await L2ERC20Token.symbol()).to.equal('')
      expect(await L2ERC777Token.name()).to.equal('')
      expect(await L2ERC777Token.symbol()).to.equal('')

      await OVM_L2TokenBridge.updateTokenInfo(
        MOCK_L1ERC20_ADDRESS,
        'Test Token',
        'TEST',
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )

      expect(await L2ERC20Token.name()).to.equal('Test Token')
      expect(await L2ERC20Token.symbol()).to.equal('TEST')
      expect(await L2ERC777Token.name()).to.equal('Test Token')
      expect(await L2ERC777Token.symbol()).to.equal('TEST')
    })
  })

  describe('migrations', () => {
    it('should migrate ERC20 tokens to ERC777', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => MOCK_L1GATEWAY_ADDRESS
      )

      await OVM_L2TokenBridge.depositAsERC777(
        MOCK_L1ERC20_ADDRESS,
        NON_ZERO_ADDRESS,
        100,
        18,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )
      await OVM_L2TokenBridge.depositAsERC20(
        MOCK_L1ERC20_ADDRESS,
        await bob.getAddress(),
        100,
        18,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )

      const L2ERC777Token = await Factory__OVM_L2ERC777.attach(
        await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)
      )
      const L2ERC20Token = await Factory__OVM_L2ERC20.attach(
        await OVM_L2TokenBridge.calculateL2ERC20Address(MOCK_L1ERC20_ADDRESS)
      )
      
      expect(await L2ERC777Token.balanceOf(await bob.getAddress())).to.equal(0)
      expect(await L2ERC20Token.balanceOf(await bob.getAddress())).to.equal(100)

      await L2ERC20Token.connect(bob).migrate(100, L2ERC777Token.address)
      
      expect(await L2ERC777Token.balanceOf(await bob.getAddress())).to.equal(100)
      expect(await L2ERC20Token.balanceOf(await bob.getAddress())).to.equal(0)
    })

    it('should migrate ERC777 tokens to ERC20', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => MOCK_L1GATEWAY_ADDRESS
      )

      await OVM_L2TokenBridge.depositAsERC777(
        MOCK_L1ERC20_ADDRESS,
        await bob.getAddress(),
        100,
        18,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )
      await OVM_L2TokenBridge.depositAsERC20(
        MOCK_L1ERC20_ADDRESS,
        NON_ZERO_ADDRESS,
        100,
        18,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )

      const L2ERC777Token = await Factory__OVM_L2ERC777.attach(
        await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)
      )
      const L2ERC20Token = await Factory__OVM_L2ERC20.attach(
        await OVM_L2TokenBridge.calculateL2ERC20Address(MOCK_L1ERC20_ADDRESS)
      )
      
      expect(await L2ERC777Token.balanceOf(await bob.getAddress())).to.equal(100)
      expect(await L2ERC20Token.balanceOf(await bob.getAddress())).to.equal(0)

      await L2ERC777Token.connect(bob).migrate(100, L2ERC20Token.address)
      
      expect(await L2ERC777Token.balanceOf(await bob.getAddress())).to.equal(0)
      expect(await L2ERC20Token.balanceOf(await bob.getAddress())).to.equal(100)
    })
  })

  describe('withdrawals', () => {
    it('should let a ERC777 token call withdraw', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => MOCK_L1GATEWAY_ADDRESS
      )

      const OVM_L2ERC777 = await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)

      await OVM_L2TokenBridge.depositAsERC777(
        MOCK_L1ERC20_ADDRESS,
        await bob.getAddress(),
        100,
        16,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )

      const L2ERC777Token = await Factory__OVM_L2ERC777.attach(
        await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)
      )

      // We created a 16-decimal ERC20. That means 10000 ERC777 should equal 100 ERC20
      await L2ERC777Token.connect(bob).withdraw(NON_ZERO_ADDRESS, 10000);

      const withdrawalCallToMessenger =
        Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert the correct cross-chain call was sent:
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(MOCK_L1GATEWAY_ADDRESS)
      // Message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        await Factory__OVM_L1TokenBridge.interface.encodeFunctionData(
          'finalizeWithdrawal',
          [MOCK_L1ERC20_ADDRESS, NON_ZERO_ADDRESS, 100]
        )
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(finalizeWithdrawalGasLimit)
    })

    it('should let a ERC20 token call withdraw', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(
        () => MOCK_L1GATEWAY_ADDRESS
      )

      const OVM_L2ERC20 = await OVM_L2TokenBridge.calculateL2ERC777Address(MOCK_L1ERC20_ADDRESS)

      await OVM_L2TokenBridge.depositAsERC20(
        MOCK_L1ERC20_ADDRESS,
        await bob.getAddress(),
        100,
        16,
        { from: Mock__OVM_L2CrossDomainMessenger.address }
      )

      const L2ERC20Token = await Factory__OVM_L2ERC20.attach(
        await OVM_L2TokenBridge.calculateL2ERC20Address(MOCK_L1ERC20_ADDRESS)
      )

      await L2ERC20Token.connect(bob).withdraw(NON_ZERO_ADDRESS, 100);

      const withdrawalCallToMessenger =
        Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert the correct cross-chain call was sent:
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(MOCK_L1GATEWAY_ADDRESS)
      // Message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        await Factory__OVM_L1TokenBridge.interface.encodeFunctionData(
          'finalizeWithdrawal',
          [MOCK_L1ERC20_ADDRESS, NON_ZERO_ADDRESS, 100]
        )
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(finalizeWithdrawalGasLimit)
    })
  })
})
