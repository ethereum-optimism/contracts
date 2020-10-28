import { expect } from '../../../setup'

/* External Imports */
import { ethers, waffle } from '@nomiclabs/buidler'
import { ContractFactory, Contract, Wallet } from 'ethers'
import { MockContract, smockit } from '@eth-optimism/smock'
import { NON_ZERO_ADDRESS } from '../../../helpers/constants'
import { keccak256 } from 'ethers/lib/utils'
import {
  DEFAULT_EIP155_TX,
  remove0x,
  serializeNativeTransaction,
  signNativeTransaction,
} from '../../../helpers'
import { getContractInterface } from '../../../../src'

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

describe('OVM_ProxyEOA', () => {
  let wallet: Wallet
  before(async () => {
    const provider = waffle.provider
    ;[wallet] = provider.getWallets()
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

  let OVM_ProxyEOAFactory: ContractFactory
  let OVM_ECDSAContractAccountFactory: ContractFactory
  before(async () => {
    OVM_ProxyEOAFactory = await ethers.getContractFactory('OVM_ProxyEOA')
    OVM_ECDSAContractAccountFactory = await ethers.getContractFactory(
      'OVM_ECDSAContractAccount'
    )
  })

  let OVM_ProxyEOA: Contract
  let OVM_ECDSAContractAccount: Contract
  beforeEach(async () => {
    OVM_ProxyEOA = await OVM_ProxyEOAFactory.deploy()
    OVM_ECDSAContractAccount = await OVM_ECDSAContractAccountFactory.deploy()

    Mock__OVM_ExecutionManager.smocked.ovmADDRESS.will.return.with(
      OVM_ProxyEOA.address
    )
    Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
      OVM_ProxyEOA.address
    )
  })

  describe('Unit tests', () => {
    it(`should be created with implementation at precompile address`, async () => {
      expect(await OVM_ProxyEOA.implementation()).to.equal(
        '0x4200000000000000000000000000000000000003'
      )
    })
    it(`should upgrade the proxy implementation`, async () => {
      const newImpl = `0x${'81'.repeat(20)}`
      await callPrecompile(
        Helper_PrecompileCaller,
        OVM_ProxyEOA,
        'upgradeEOA',
        [newImpl]
      )
      expect(await OVM_ProxyEOA.implementation()).to.equal(newImpl)
    })
    it(`should not allow upgrade of the proxy implementation by another account`, async () => {
      Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
        await wallet.getAddress()
      )
      const newImpl = `0x${'81'.repeat(20)}`
      await expect(
        callPrecompile(Helper_PrecompileCaller, OVM_ProxyEOA, 'upgradeEOA', [
          newImpl,
        ])
      ).to.be.revertedWith('EOAs can only upgrade their own EOA implementation')
    })
  })
  describe('Integration tests', () => {
    it(`should not throw when calling ovmCALL through fallback to EOA execute`, async () => {
      await callPrecompile(
        Helper_PrecompileCaller,
        OVM_ProxyEOA,
        'upgradeEOA',
        [OVM_ECDSAContractAccount.address]
      )
      Mock__OVM_ExecutionManager.smocked.ovmADDRESS.will.return.with(
        await wallet.getAddress()
      )
      Mock__OVM_ExecutionManager.smocked.ovmCHAINID.will.return.with(420)
      Mock__OVM_ExecutionManager.smocked.ovmGETNONCE.will.return.with(99)
      Mock__OVM_ExecutionManager.smocked.ovmCALL.will.return.with([true, '0x'])
      const encodedTx = serializeNativeTransaction(DEFAULT_EIP155_TX)
      const sig = await signNativeTransaction(wallet, DEFAULT_EIP155_TX)
      const calldata = getContractInterface(
        'OVM_ECDSAContractAccount'
      ).encodeFunctionData('execute', [
        encodedTx,
        0, //isEthSignedMessage
        `0x${sig.v}`, //v
        `0x${sig.r}`, //r
        `0x${sig.s}`, //s
      ])

      await Helper_PrecompileCaller.callPrecompile(
        OVM_ProxyEOA.address,
        calldata
      )

      // const ovmCALL: any = Mock__OVM_ExecutionManager.smocked.ovmCALL.calls[0]
      // expect(ovmCALL._gasLimit).to.equal(DEFAULT_EIP155_TX.gasLimit)
      // expect(ovmCALL._address).to.equal(DEFAULT_EIP155_TX.to)
      // expect(ovmCALL._calldata).to.equal(DEFAULT_EIP155_TX.data)
    })
  })
})
