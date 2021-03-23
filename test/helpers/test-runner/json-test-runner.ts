import { expect } from '../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Contract, BigNumber } from 'ethers'

const bnRegex = /^\d+n$/gm

const bigNumberify = (arr: any[]) => {
  return arr.map((el: any) => {
    if (typeof el === 'number') {
      return BigNumber.from(el)
    } else if (typeof el === 'string' && bnRegex.test(el)) {
      return BigNumber.from(el.slice(0, el.length - 1))
    } else if (typeof el === 'string' && el.length > 2 && el.startsWith('0x')) {
      return BigNumber.from(el.toLowerCase())
    } else if (Array.isArray(el)) {
      return bigNumberify(el)
    } else {
      return el
    }
  })
}

export const runJsonTest = (contractName: string, json: any): void => {
  let contract: Contract
  before(async () => {
    contract = await (await ethers.getContractFactory(contractName)).deploy()
  })

  for (const [functionName, functionTests] of Object.entries(json)) {
    describe(functionName, () => {
      for (const [key, test] of Object.entries(functionTests)) {
        it(`should run test: ${key}`, async () => {
          if (test.revert) {
            await expect(contract.functions[functionName](...test.in)).to.be
              .reverted
          } else {
            expect(
              bigNumberify(await contract.functions[functionName](...test.in))
            ).to.deep.equal(bigNumberify(test.out))
          }
        })
      }
    })
  }
}
