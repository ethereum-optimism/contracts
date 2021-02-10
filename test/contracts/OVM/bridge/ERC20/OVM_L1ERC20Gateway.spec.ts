import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract, BigNumber } from 'ethers'
import { smockit, MockContract } from '@eth-optimism/smock'

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

describe.only('OVM_L1ERC20Gateway', () => {
  // init signers
  let alice: Signer
  let bob: Signer

  // we can just make up this string since it's on the "other" Layer
  const mockL2ERC20Gateway: string = '0x1234123412341234123412341234123412341234'


  let Factory__OVM_L2ERC20Gateway: ContractFactory
  let Factory__WETH: ContractFactory // or Mock contract? 
  before(async () => {
    Factory__OVM_L2ERC20Gateway = await ethers.getContractFactory('OVM_L2ERC20Gateway')
    Factory__WETH = await ethers.getContractFactory('WETH') // https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code

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
    Mock__OVM_ETH = await smockit(
      await ethers.getContractFactory('OVM_ETH')
    )

    // Deploy the contract under test: 
    OVM_L1ERC20Gateway = await(
      await ethers.getContractFactory('OVM_L1ERC20Gateway')
    ).deploy(
      WETH.address,
      _l2ERC20Gateway,
      iAbs_BaseCrossDomainMessenger _messenger 
    )

    await OVM_L2ERC20Gateway.init(mockL1ERC20Gateway)
  })

  it('works', async () => {
    expect(true);
  })
})
