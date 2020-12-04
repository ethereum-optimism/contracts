import { expect } from '../../../setup'

/* External Imports */
import * as rlp from 'rlp'
import { ethers } from '@nomiclabs/buidler'
import { Contract } from 'ethers'

/* Internal Imports */
import { TrieTestGenerator } from '../../../helpers'

const NODE_COUNTS = [1, 2, 128]

describe('Lib_MerkleTrie', () => {
  let Lib_MerkleTrie: Contract
  before(async () => {
    Lib_MerkleTrie = await (
      await ethers.getContractFactory('TestLib_MerkleTrie')
    ).deploy()
  })

  describe('verifyInclusionProof', () => {
    for (const nodeCount of NODE_COUNTS) {
      describe(`inside a trie with ${nodeCount} nodes`, () => {
        let generator: TrieTestGenerator
        before(async () => {
          generator = await TrieTestGenerator.fromRandom({
            seed: `seed.incluson.${nodeCount}`,
            nodeCount,
            secure: false,
          })
        })

        for (
          let i = 0;
          i < nodeCount;
          i += nodeCount / (nodeCount > 8 ? 8 : 1)
        ) {
          it(`should correctly prove inclusion for node #${i}`, async () => {
            const test = await generator.makeInclusionProofTest(i)

            expect(
              await Lib_MerkleTrie.verifyInclusionProof(
                test.key,
                test.val,
                test.proof,
                test.root
              )
            ).to.equal(true)
          })
        }
      })
    }
  })

  describe('update', () => {
    for (const nodeCount of NODE_COUNTS) {
      describe(`inside a trie with ${nodeCount} nodes`, () => {
        let generator: TrieTestGenerator
        before(async () => {
          generator = await TrieTestGenerator.fromRandom({
            seed: `seed.update.${nodeCount}`,
            nodeCount,
            secure: false,
          })
        })

        for (
          let i = 0;
          i < nodeCount;
          i += nodeCount / (nodeCount > 8 ? 8 : 1)
        ) {
          it(`should correctly update node #${i}`, async () => {
            const test = await generator.makeNodeUpdateTest(
              i,
              '0x1234123412341234'
            )

            expect(
              await Lib_MerkleTrie.update(
                test.key,
                test.val,
                test.proof,
                test.root
              )
            ).to.equal(test.newRoot)
          })
        }
      })
    }
  })

  describe('get', () => {
    for (const nodeCount of NODE_COUNTS) {
      describe(`inside a trie with ${nodeCount} nodes`, () => {
        let generator: TrieTestGenerator
        before(async () => {
          generator = await TrieTestGenerator.fromRandom({
            seed: `seed.get.${nodeCount}`,
            nodeCount,
            secure: false,
          })
        })

        for (
          let i = 0;
          i < nodeCount;
          i += nodeCount / (nodeCount > 8 ? 8 : 1)
        ) {
          it(`should correctly get the value of node #${i}`, async () => {
            const test = await generator.makeInclusionProofTest(i)

            expect(
              await Lib_MerkleTrie.get(test.key, test.proof, test.root)
            ).to.deep.equal([true, test.val])
          })

          if (i === 32) { // TODO: run for multiple times for all tests
            it(`should revert when calling get on an incorrect key`, async () => {
              const test = await generator.makeInclusionProofTest(0)
              const test2 = await generator.makeInclusionProofTest(16)
              await expect (
                Lib_MerkleTrie.get(test2.key, test.proof, test.root)
              ).to.be.revertedWith("Invalid large internal hash")
            })

            it(`should revert when calling get on an incorrect proof`, async () => {
              const test = await generator.makeInclusionProofTest(0)
              console.log("testkey", 0, test.key)
              console.log("testkey root", test.root)
              let decodedProof = rlp.decode(test.proof)
              console.log("rlp decoded proof[0]", decodedProof[0])
              const len = decodedProof[0].write('abcd', 8); // change the 1st element (root) of the proof
              console.log("subbedin", decodedProof[0])
              const badProof = rlp.encode(decodedProof as rlp.
                Input)
              await expect (
                Lib_MerkleTrie.get(test.key, badProof, test.root)
              ).to.be.revertedWith("Invalid root hash")
            })

            it.only(`should revert when calling get on an incorrect key`, async () => {
              const test = await generator.makeInclusionProofTest(0)
              console.log("orig key", test.key, test.key.length)
              let newKey = test.key.slice(0, test.key.length - 8)
              newKey = newKey.concat('88888888');
              console.log("new key", newKey, newKey.length)
              await expect (
                Lib_MerkleTrie.get(newKey, test.proof, test.root)
              ).to.be.revertedWith("Something?")
            })
          }

        }
      })
    }
  })
})
