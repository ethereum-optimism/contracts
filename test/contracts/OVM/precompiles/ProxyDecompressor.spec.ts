import { expect } from '../../../setup'

/* External Imports */
import { ethers, waffle } from '@nomiclabs/buidler'
import { ContractFactory, Contract, Wallet } from 'ethers'
import { MockContract, smockit } from '@eth-optimism/smock'
import { encodeSequencerCalldata, DEFAULT_EIP155_TX } from '../../../helpers'

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

describe.only('ProxyDecompressor', () => {
  let wallet: Wallet
  before(async () => {
    const provider = waffle.provider
    ;[wallet] = provider.getWallets()
  })

  let Factory__ProxyDecompressor: ContractFactory
  before(async () => {
    Factory__ProxyDecompressor = await ethers.getContractFactory(
      'ProxyDecompressor'
    )
  })

  let Mock__OVM_ExecutionManager: MockContract
  let Helper_PrecompileCaller: Contract
  let SequencerMessageDecompressor: Contract
  before(async () => {
    Mock__OVM_ExecutionManager = smockit(
      await ethers.getContractFactory('OVM_ExecutionManager')
    )

    Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
      await wallet.getAddress()
    )

    Helper_PrecompileCaller = await (
      await ethers.getContractFactory('Helper_PrecompileCaller')
    ).deploy()

    Helper_PrecompileCaller.setTarget(Mock__OVM_ExecutionManager.address)

    SequencerMessageDecompressor = await (
      await ethers.getContractFactory('SequencerMessageDecompressor')
    ).deploy()
  })

  let ProxyDecompressor: Contract
  beforeEach(async () => {
    ProxyDecompressor = await Factory__ProxyDecompressor.deploy()
  })
  it(`should init the proxy with owner and implementation`, async () => {
    await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
      SequencerMessageDecompressor.address,
      await wallet.getAddress(),
    ])

    expect(await ProxyDecompressor.owner()).to.equal(await wallet.getAddress())

    expect(await ProxyDecompressor.implementation()).to.equal(
      SequencerMessageDecompressor.address
    )
  })

  it(`upgrade Decompressor`, async () => {
    await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
      SequencerMessageDecompressor.address,
      await wallet.getAddress(),
    ])
    await callPrecompile(
      Helper_PrecompileCaller,
      ProxyDecompressor,
      'upgradeDecompressor',
      [`0x${'12'.repeat(20)}`]
    )
    expect(await ProxyDecompressor.implementation()).to.equal(
      `0x${'12'.repeat(20)}`
    )
  })

  it(`successfully calls ovmCREATEEOA through decompressor fallback`, async () => {
    await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
      SequencerMessageDecompressor.address,
      await wallet.getAddress(),
    ])

    const calldata = await encodeSequencerCalldata(wallet, DEFAULT_EIP155_TX, 1)

    await Helper_PrecompileCaller.callPrecompile(
      ProxyDecompressor.address,
      calldata
    )
    const call: any = Mock__OVM_ExecutionManager.smocked.ovmCREATEEOA.calls[0]
    const eoaAddress = ethers.utils.recoverAddress(call._messageHash, {
      v: call._v + 27,
      r: call._r,
      s: call._s,
    })
    expect(eoaAddress).to.equal(await wallet.getAddress())
  })
})
