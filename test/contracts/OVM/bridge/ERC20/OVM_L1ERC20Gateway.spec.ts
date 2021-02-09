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

  // we can just 
  const mockL2ERC20Gateway: string = '0x1234123412341234123412341234123412341234'

  let mockL1CrossDomainMessengerAddress: string
  let Mock__OVM_L1CrossDomainMessenger: MockContract
  let OVM_L2ERC20Gateway: Contract

  let Factory__OVM_L1ERC20Gateway: ContractFactory
  before(async () => {
    Factory__OVM_L1ERC20Gateway = await ethers.getContractFactory('OVM_L1ERC20Gateway')
  })



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

