import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract, BigNumber } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'

/* Internal Imports */
import {
  NON_ZERO_ADDRESS, ZERO_ADDRESS
} from '../../../../helpers'

const HARDCODED_GASLIMIT = 420069
const decimals = 1

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER = 'OVM_XCHAIN: wrong sender of cross-domain message'
const MOCK_L1GATEWAY_ADDRESS: string = '0x1234123412341234123412341234123412341234'

const HARDCODED_GASLIMIT = 420069
const decimals = 1 // what to set this to?

describe.only('OVM_L1ERC20Gateway', () => {
  // init signers
  let alice: Signer
  let bob: Signer

  // we can just make up this string since it's on the "other" Layer
  const mockL2ERC20Gateway: string = '0x1234123412341234123412341234123412341234'


  let Mock__OVM_L2ERC20Gateway: MockContract
  let Mock__WETH: MockContract // or Mock contract? 
  before(async () => {
    Mock__OVM_L2ERC20Gateway = await smockit(
      await ethers.getContractFactory('OVM_L2ERC20Gateway')
    )
    Mock__WETH = await smockit(
      await ethers.getContractFactory('OMV_ETH')
    )
  })

  let mockL1CrossDomainMessengerAddress: string
  let Mock__OVM_L1CrossDomainMessenger: MockContract
  
  // The contract under test. Everything else is a mock.
  let OVM_L1ERC20Gateway: Contract
  beforeEach(async () => {
    let signer
    ;[signer, alice, bob] = await ethers.getSigners()
    // though we don't keep track of the signer here, it needs to have come from an ethers signer so that {from: mockL2...} will work.
    mockL1CrossDomainMessengerAddress = await signer.getAddress() 

    // get a mock L1 messenger
    Mock__OVM_L1CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L2CrossDomainMessenger'),
      { address: mockL1CrossDomainMessengerAddress }
    )
  
    // create a mock WETH contract on L1 (just using OVM_ETH)
    // Mock__WETH = await smockit(
    //   await ethers.getContractFactory('OVM_ETH')
    // )

    // Deploy the contract under test: 
    OVM_L1ERC20Gateway = await(
      await ethers.getContractFactory('OVM_L1ERC20Gateway')
    ).deploy(
      Mock__WETH.address,
      Mock__OVM_L2ERC20Gateway.address,
      Mock__OVM_L1CrossDomainMessenger.address
    )

  })

  it('works', async () => {
    expect(true);
  })
})
