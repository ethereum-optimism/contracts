import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract, BigNumber } from 'ethers'
import { smockit, MockContract, smoddit, ModifiableContract } from '@eth-optimism/smock'

/* Internal Imports */
import {
  NON_ZERO_ADDRESS, ZERO_ADDRESS
} from '../../../../helpers'

const HARDCODED_GASLIMIT = 420069
const decimals = 1

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER = 'OVM_XCHAIN: wrong sender of cross-domain message'

describe.only('OVM_L1ERC20Gateway', () => {
  // init signers
  let alice: Signer
  
  let bob: Signer

  // we can just make up this string since it's on the "other" Layer
  let Mock__OVM_L2ERC20Gateway: MockContract
  let Factory__L1ERC20: ContractFactory
  let L1ERC20: Contract
  const initialSupply = 1_000
  before(async () => {
    Mock__OVM_L2ERC20Gateway = await smockit(
      await ethers.getContractFactory('OVM_L2ERC20Gateway')
    )
    
    // deploy an ERC20 contract on L1
    // // @todo: use the actual implementation
    Factory__L1ERC20 = (
      await ethers.getContractFactory('OVM_ETH')
    )
    
    L1ERC20 = await Factory__L1ERC20.deploy(
      ZERO_ADDRESS, // temp: address manager 
      initialSupply,
      'L1ERC20',
      18,
      'ERC' // temp: 
    )
  })

  let OVM_L1ERC20Gateway: Contract
  let Mock__OVM_L1CrossDomainMessenger: MockContract
  beforeEach(async () => {
        // Create a special signer which will enable us to send messages from the L1Messenger contract
    let l1MessengerImpersonator: Signer
    ;[l1MessengerImpersonator, alice, bob] = await ethers.getSigners()
    // Get a new mock L1 messenger
    Mock__OVM_L1CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L1CrossDomainMessenger'),
      { address: await l1MessengerImpersonator.getAddress() } // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
    )

    // Deploy the contract under test
    OVM_L1ERC20Gateway = await (
      await ethers.getContractFactory('OVM_L1ERC20Gateway')
    ).deploy(
      L1ERC20.address,
      Mock__OVM_L2ERC20Gateway.address,
      Mock__OVM_L1CrossDomainMessenger.address
    )

  })

  describe('finalizeWithdrawal', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L1 account', async () => {
         // Deploy new gateway, initialize with random messenger
        OVM_L1ERC20Gateway = await (
          await ethers.getContractFactory('OVM_L1ERC20Gateway')
        ).deploy(
          L1ERC20.address,
          Mock__OVM_L2ERC20Gateway.address,
          NON_ZERO_ADDRESS
        )

      await expect(
        OVM_L1ERC20Gateway.finalizeWithdrawal(ZERO_ADDRESS, 1)
      ).to.be.revertedWith(ERR_INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L2ERC20Gateway)', async () => {
      Mock__OVM_L1CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(() => 
        NON_ZERO_ADDRESS
      )

      await expect (
        OVM_L1ERC20Gateway.finalizeWithdrawal(
          ZERO_ADDRESS,
          1, 
          { from: Mock__OVM_L1CrossDomainMessenger.address }
        )
      ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should credit funds to the withdrawer', async () => {
      // make sure no balance at start of test
      await expect (
        await L1ERC20.balanceOf(NON_ZERO_ADDRESS)
      ).to.be.equal(0)

      const withdrawalAmount = 100
      Mock__OVM_L1CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(() => 
        Mock__OVM_L2ERC20Gateway.address
      )

      await L1ERC20.transfer(OVM_L1ERC20Gateway.address, withdrawalAmount)      

      await OVM_L1ERC20Gateway.finalizeWithdrawal(
        NON_ZERO_ADDRESS,
        withdrawalAmount, 
        { from: Mock__OVM_L1CrossDomainMessenger.address }
      )
      
      await expect (
        await L1ERC20.balanceOf(NON_ZERO_ADDRESS)
      ).to.be.equal(withdrawalAmount)
    })

    it.skip('finalizeWithdrawalAndCall(): should should credit funds to the withdrawer, and forward from and data', async () => {
      // TODO: implement this functionality in a future update
      expect.fail()
    })
  })

  describe('deposits', () => {
    const INITIAL_TOTAL_SUPPLY = 100_000
    const ALICE_INITIAL_BALANCE = 50_000
    let depositer: string
    const depositAmount = 1_000
    let L1ERC20: Contract

    beforeEach(async () => {
      // Deploy a smodded ERC20 on L1 so we can give some balances to withdraw
      const Factory__L1ERC20 = await ethers.getContractFactory('OVM_ETH')
      
      // Deploy the L1 ERC20 token, Alice will receive the full initialSupply
      L1ERC20 = await Factory__L1ERC20.deploy(
        ZERO_ADDRESS, // temp: address manager 
        INITIAL_TOTAL_SUPPLY,
        'L1ERC20', // token name
        18, // decimals
        'ERC' // temp: token symbol
      )

      // get a new mock L1 messenger
      Mock__OVM_L1CrossDomainMessenger = await smockit(
        await ethers.getContractFactory('OVM_L1CrossDomainMessenger')
      )
      
      // Deploy the contract under test: 
      OVM_L1ERC20Gateway = await (
        await ethers.getContractFactory('OVM_L1ERC20Gateway')
      ).deploy(
        L1ERC20.address,
        Mock__OVM_L2ERC20Gateway.address,
        Mock__OVM_L1CrossDomainMessenger.address
      )

      // the Signer sets approve for the L1 Gateway
      await L1ERC20.approve(OVM_L1ERC20Gateway.address, depositAmount)
      depositer = await L1ERC20.signer.getAddress()
      
    })

    it('deposit() escrows the deposit amount and sends the correct deposit message', async () => { 
      // alice calls deposit on the gateway and the L1 gateway calls transferFrom on the token
      await OVM_L1ERC20Gateway.deposit(depositAmount)
      const depositCallToMessenger = Mock__OVM_L1CrossDomainMessenger.smocked.sendMessage.calls[0]
      
      const signerBalance = await L1ERC20.balanceOf(depositer)
      expect(signerBalance).to.equal(INITIAL_TOTAL_SUPPLY - depositAmount)

      // gateway's balance is increased
      const gatewayBalance = await L1ERC20.balanceOf(OVM_L1ERC20Gateway.address)
      expect(gatewayBalance).to.equal(depositAmount)

      // Check the correct cross-chain call was sent:
      // Message should be sent to the L2ERC20Gateway on L2
      expect(depositCallToMessenger._target).to.equal(Mock__OVM_L2ERC20Gateway.address)  
      // Message data should be a call telling the L2ERC20Gateway to finalize the deposit

      // the L1 gateway sends the correct message to the L1 messenger
      expect(depositCallToMessenger._message).to.equal(
        await Mock__OVM_L2ERC20Gateway.interface.encodeFunctionData(
          'finalizeDeposit',
          [depositer, depositAmount] 
        )
      )
      expect(depositCallToMessenger._gasLimit).to.equal(HARDCODED_GASLIMIT)

    })

    it('depositTo() escrows the deposit amount and sends the correct deposit message', async () => { 

      // depositor calls deposit on the gateway and the L1 gateway calls transferFrom on the token
      const bobsAddress = await bob.getAddress()
      await OVM_L1ERC20Gateway.depositTo(bobsAddress, depositAmount)
      const depositCallToMessenger = Mock__OVM_L1CrossDomainMessenger.smocked.sendMessage.calls[0]
    
      const signerBalance = await L1ERC20.balanceOf(depositer)
      expect(signerBalance).to.equal(INITIAL_TOTAL_SUPPLY - depositAmount)

      // gateway's balance is increased
      const gatewayBalance = await L1ERC20.balanceOf(OVM_L1ERC20Gateway.address)
      expect(gatewayBalance).to.equal(depositAmount)

      // Check the correct cross-chain call was sent:
      // Message should be sent to the L2ERC20Gateway on L2
      expect(depositCallToMessenger._target).to.equal(Mock__OVM_L2ERC20Gateway.address)  
        // Message data should be a call telling the L2ERC20Gateway to finalize the deposit

      // the L1 gateway sends the correct message to the L1 messenger
      expect(depositCallToMessenger._message).to.equal(
        await Mock__OVM_L2ERC20Gateway.interface.encodeFunctionData(
          'finalizeDeposit',
          [bobsAddress, depositAmount]
        )
      )
      expect(depositCallToMessenger._gasLimit).to.equal(HARDCODED_GASLIMIT)
    })
  })
})