import { expect } from '../../../setup'

/* External Imports */
import { ethers } from '@nomiclabs/buidler'
import { Contract } from 'ethers'

/* Internal Imports */
import { SAFETY_CHECKER_TEST_JSON } from '../../../data'

describe.only('OVM_SafetyChecker', () => {
  let OVM_SafetyChecker: Contract
  before(async () => {
    const Factory__OVM_SafetyChecker = await ethers.getContractFactory(
      'OVM_SafetyChecker'
    )

    OVM_SafetyChecker = await Factory__OVM_SafetyChecker.deploy()
  })

  describe('isBytecodeSafe()', () => {
    for (const testName of Object.keys(SAFETY_CHECKER_TEST_JSON)) {
      // if (testName.indexOf('call') >= 0) {
        const test = SAFETY_CHECKER_TEST_JSON[testName]
        it(`should correctly classify: ${testName}`, async () => {
          expect(await OVM_SafetyChecker.isBytecodeSafe(test.in)).to.equal(
            test.out
          )
        })
      // }
    }
  })
})
