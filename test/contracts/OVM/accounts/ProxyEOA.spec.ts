import { expect } from '../../../setup'

/* External Imports */
import { ethers } from '@nomiclabs/buidler'
import { ContractFactory, Contract, Wallet, Signer } from 'ethers'
import { MockContract, smockit } from '@eth-optimism/smock'
import { NON_ZERO_ADDRESS } from '../../../helpers/constants'
import { keccak256 } from 'ethers/lib/utils'
import { remove0x } from '../../../helpers'

const callPrecompile = async (
  Helper_PrecompileCaller: Contract,
  precompile: Contract,
  functionName: string,
  functionParams?: any[]
): Promise<any> => {
  return Helper_PrecompileCaller.callPrecompile(
    precompile.address,
    precompile.interface.encodeFunctionData(functionName, functionParams || [])
  )
}

describe('ProxyEOA', () => {
  let signer: Signer
  before(async () => {
    ;[signer] = await ethers.getSigners()
  })

  let Mock__OVM_ExecutionManager: MockContract
  let Helper_PrecompileCaller: Contract
  before(async () => {
    Mock__OVM_ExecutionManager = smockit(
      await ethers.getContractFactory('OVM_ExecutionManager')
    )

    Helper_PrecompileCaller = await (
      await ethers.getContractFactory('Helper_PrecompileCaller')
    ).deploy()

    Helper_PrecompileCaller.setTarget(Mock__OVM_ExecutionManager.address)
  })

  let ProxyEOAFactory: ContractFactory
  before(async () => {
    ProxyEOAFactory = await ethers.getContractFactory('ProxyEOA')
  })

  let ProxyEOA: Contract
  beforeEach(async () => {
    ProxyEOA = await ProxyEOAFactory.deploy()

    Mock__OVM_ExecutionManager.smocked.ovmADDRESS.will.return.with(
      await ProxyEOA.address
    )
  })

  describe('Unit tests', () => {
    it(`should be created with implementation at precompile address`, async () => {
      expect(await ProxyEOA.implementation()).to.equal(`0x${'12'.repeat(20)}`)
    })
    it(`should upgrade the proxy implementation`, async () => {
      Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
        ProxyEOA.address
      )
      const newImpl = `0x${'81'.repeat(20)}`
      await callPrecompile(Helper_PrecompileCaller, ProxyEOA, 'upgradeEOA', [
        newImpl,
      ])
      expect(await ProxyEOA.implementation()).to.equal(newImpl)
    })
    it(`should not allow upgrade of the proxy implementation by another account`, async () => {
      Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
        await signer.getAddress()
      )
      const newImpl = `0x${'81'.repeat(20)}`
      await expect(
        callPrecompile(Helper_PrecompileCaller, ProxyEOA, 'upgradeEOA', [
          newImpl,
        ])
      ).to.be.revertedWith('EOAs can only upgrade their own EOA implementation')
    })
  })
})
