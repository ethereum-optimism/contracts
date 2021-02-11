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
const MOCK_L1GATEWAY_ADDRESS: string = '0x1234123412341234123412341234123412341234'

describe.only('OVM_L1ERC20Gateway', () => {
  // init signers
  let alice: Signer
  let bob: Signer

  // we can just make up this string since it's on the "other" Layer
  const mockL2ERC20Gateway: string = '0x1234123412341234123412341234123412341234'


  let Mock__OVM_L2ERC20Gateway: MockContract
  let Factory__L1ERC20: ContractFactory
  let L1ERC20: Contract
  const initialSupply = 1_000
  before(async () => {
    Mock__OVM_L2ERC20Gateway = await smockit(
      await ethers.getContractFactory('OVM_L2ERC20Gateway')
    )
    // // deploy an actual ERC20 contract on L1
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
  let mockL1CrossDomainMessengerAddress: string
  let Mock__OVM_L1CrossDomainMessenger: MockContract
  beforeEach(async () => {
    let l1MessengerImpersonator: Signer
    ;[l1MessengerImpersonator, alice, bob] = await ethers.getSigners()

    // get a mock new L1 messenger
    Mock__OVM_L1CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L1CrossDomainMessenger'),
      { address: await l1MessengerImpersonator.getAddress() } // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
    )
    mockL1CrossDomainMessengerAddress = Mock__OVM_L1CrossDomainMessenger.address;

    // Deploy the contract under test: 
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

    const withdrawalAmount = 100
    it('should credit funds to the withdrawer', async () => {
      Mock__OVM_L1CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(() => 
        Mock__OVM_L2ERC20Gateway.address
      )

      await L1ERC20.transfer(OVM_L1ERC20Gateway.address, depositAmount)      

      await OVM_L1ERC20Gateway.finalizeWithdrawal(
        NON_ZERO_ADDRESS,
        withdrawalAmount, 
        { from: Mock__OVM_L1CrossDomainMessenger.address }
      )
      
      expect(
        L1ERC20.balanceOf(NON_ZERO_ADDRESS)
      ).to.be.equal(withdrawalAmount)

    })
  })

  describe.skip('deposits', () => {
    const INITIAL_TOTAL_SUPPLY = 100_000
    const ALICE_INITIAL_BALANCE = 50_000
    const withdrawAmount = 1_000
    let SmoddedL2Gateway: ModifiableContract
    beforeEach(async () => {
      // Deploy a smodded gateway so we can give some balances to withdraw
      // SmoddedL2Gateway = await (await smoddit('OVM_L2ERC20Gateway', alice)).deploy(
      //   Mock__OVM_L2CrossDomainMessenger.address,
      //   'ovmWETH', // here: https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code
      //   decimals
      // )
      // await SmoddedL2Gateway.init(
      //   MOCK_L1GATEWAY_ADDRESS
      // )

      // // Populate the initial state with a total supply and some money in alice's balance
      // const aliceAddress = await alice.getAddress()
      // SmoddedL2Gateway.smodify.put({
      //   totalSupply: INITIAL_TOTAL_SUPPLY,
      //   balances: {
      //     [aliceAddress] : ALICE_INITIAL_BALANCE
      //   }
      // })
    })

    it('deposit() escrows the deposit amount and sends the correct deposit message', async () => { 
      expect.fail()
    })

    it('depositTo() escrows the deposit amount and sends the correct deposit message', async () => { 
      expect.fail()
    })
  })
})