import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from '@nomiclabs/buidler'
import { Contract, ContractFactory } from 'ethers'

/* Internal Imports */
import { SAFETY_CHECKER_TEST_JSON } from '../../../../data'

describe('EM MethodIds', () => {
  let Factory__OVM_ExecutionManager: ContractFactory
  before(async () => {
    Factory__OVM_ExecutionManager = await ethers.getContractFactory(
      'OVM_ExecutionManager'
    )

  })
    it('print ovmREVERT', async () => {
      console.log(
        Factory__OVM_ExecutionManager.interface.encodeFunctionData(
          'ovmREVERT',
          ['0x4204206969deadbeef']
        )
      )
    })

    it.only('print all', async () => {
        for (let frag of Factory__OVM_ExecutionManager.interface.fragments) {
            try {
              console.log(`func ${frag.name}: ${Factory__OVM_ExecutionManager.interface.getSighash(frag as any)}`)
            } catch {
              console.log(`failed to print methodId for fragment ${frag.name}`)
            }
        }
    })
})
