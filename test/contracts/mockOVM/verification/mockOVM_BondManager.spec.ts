import { expect } from '../../../setup'

/* External Imports */
import { ethers } from '@nomiclabs/buidler'
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
} from '../../../helpers'
import { getContractInterface } from '../../../../src'
import { keccak256 } from 'ethers/lib/utils'

describe('mockOVM_BondManager', () => {
    let sequencer: Signer
    let nonSequencer: Signer
    before(async () => {
        ;[sequencer, nonSequencer] = await ethers.getSigners()
    })

  let AddressManager: Contract
  before(async () => {
    AddressManager = await makeAddressManager()
  })

  let mockOVM_BondManager: Contract
  before(async () => {
    mockOVM_BondManager = await (
      await ethers.getContractFactory('mockOVM_BondManager')
    ).deploy(
        AddressManager.address
    )
   
    AddressManager.setAddress(
        'OVM_Sequencer',
        await sequencer.getAddress()
    )
  })

  describe('isCollateralized', () => {
      it('should return true for OVM_Sequencer', async () => {
          expect(
              await mockOVM_BondManager.isCollateralized(await sequencer.getAddress())
          ).to.equal(true)
      })

      it('should return false for non-sequencer', async () => {
        expect(
            await mockOVM_BondManager.isCollateralized(await nonSequencer.getAddress())
        ).to.equal(false)
      })
  })
})
