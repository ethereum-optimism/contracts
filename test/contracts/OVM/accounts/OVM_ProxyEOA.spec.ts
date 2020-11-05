import { expect } from '../../../setup'

/* External Imports */
import { ethers, waffle } from '@nomiclabs/buidler'
import { ContractFactory, Contract, Wallet } from 'ethers'
import { MockContract, smockit } from '@eth-optimism/smock'
import { NON_ZERO_ADDRESS } from '../../../helpers/constants'
import { AbiCoder, keccak256 } from 'ethers/lib/utils'
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
  functionParams?: any[],
  ethCall: boolean = false
): Promise<any> => {
  if (ethCall) {
    console.log('BRUH')
    const ret = await Helper_PrecompileCaller.callStatic.callPrecompileAbi(
      precompile.address,
      precompile.interface.encodeFunctionData(functionName, functionParams || [])
    )
    console.log('return value!', ret)
    return ret
  }
  return Helper_PrecompileCaller.callPrecompile(
    precompile.address,
    precompile.interface.encodeFunctionData(functionName, functionParams || [])
  )
}

const eoaDefaultAddr = '0x4200000000000000000000000000000000000003'

describe.only('OVM_ProxyEOA', () => {
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
    OVM_ProxyEOA = await OVM_ProxyEOAFactory.deploy(eoaDefaultAddr)
    OVM_ECDSAContractAccount = await OVM_ECDSAContractAccountFactory.deploy()

    Mock__OVM_ExecutionManager.smocked.ovmADDRESS.will.return.with(
      OVM_ProxyEOA.address
    )
    Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
      OVM_ProxyEOA.address
    )
  })

  describe('Unit tests', () => {
    it.only(`should be created with implementation at precompile address`, async () => {
      const addrToBytes32 = (addr: string) => '0x' + '00'.repeat(12) + remove0x(addr)
      const eoaDefaultAddrBytes32 = addrToBytes32(eoaDefaultAddr)
      Mock__OVM_ExecutionManager.smocked.ovmSLOAD.will.return.with(eoaDefaultAddrBytes32)
      const implAddr = await callPrecompile(
        Helper_PrecompileCaller,
        OVM_ProxyEOA,
        'getImplementation',
        [],
        true
      )
      expect(implAddr).to.equal(eoaDefaultAddr)
    })
    it(`should upgrade the proxy implementation`, async () => {
      const newImpl = `0x${'81'.repeat(20)}`
      await callPrecompile(
        Helper_PrecompileCaller,
        OVM_ProxyEOA,
        'upgrade',
        [newImpl]
      )
      expect(await OVM_ProxyEOA.getImplementation()).to.equal(newImpl)
    })
    it(`should not allow upgrade of the proxy implementation by another account`, async () => {
      Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
        await wallet.getAddress()
      )
      const newImpl = `0x${'81'.repeat(20)}`
      await callPrecompile(
        Helper_PrecompileCaller,
        OVM_ProxyEOA,
        'upgrade',
        [newImpl]
      )
      const ovmREVERT: any =
        Mock__OVM_ExecutionManager.smocked.ovmREVERT.calls[0]
      expect(ethers.utils.toUtf8String(ovmREVERT._data)).to.equal(
        'EOAs can only upgrade their own EOA implementation'
      )
    })
  })
  describe('Integration tests', () => {
    it(`should not throw when calling ovmCALL through fallback to EOA execute`, async () => {
      await callPrecompile(
        Helper_PrecompileCaller,
        OVM_ProxyEOA,
        'upgrade',
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
