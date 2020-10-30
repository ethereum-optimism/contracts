import { expect } from '../../../setup'

/* External Imports */
import { ethers, waffle } from '@nomiclabs/buidler'
import { ContractFactory, Contract, Wallet } from 'ethers'
import { MockContract, smockit } from '@eth-optimism/smock'
import {
  encodeSequencerCalldata,
  DEFAULT_EIP155_TX,
  ZERO_ADDRESS,
} from '../../../helpers'

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

describe('OVM_ProxyEntrypoint', () => {
  let wallet: Wallet
  before(async () => {
    const provider = waffle.provider
    ;[wallet] = provider.getWallets()
  })

  let Factory__OVM_ProxyEntrypoint: ContractFactory
  before(async () => {
    Factory__OVM_ProxyEntrypoint = await ethers.getContractFactory(
      'OVM_ProxyEntrypoint'
    )
  })

  let Mock__OVM_ExecutionManager: MockContract
  let Helper_PrecompileCaller: Contract
  let OVM_SequencerEntrypoint: Contract
  before(async () => {
    Mock__OVM_ExecutionManager = smockit(
      await ethers.getContractFactory('OVM_ExecutionManager')
    )

    Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
      await wallet.getAddress()
    )

    Mock__OVM_ExecutionManager.smocked.ovmEXTCODESIZE.will.return.with(0)
    Mock__OVM_ExecutionManager.smocked.ovmCHAINID.will.return.with(420)

    Helper_PrecompileCaller = await (
      await ethers.getContractFactory('Helper_PrecompileCaller')
    ).deploy()

    Helper_PrecompileCaller.setTarget(Mock__OVM_ExecutionManager.address)

    OVM_SequencerEntrypoint = await (
      await ethers.getContractFactory('OVM_SequencerEntrypoint')
    ).deploy()
  })

  let OVM_ProxyEntrypoint: Contract
  beforeEach(async () => {
    OVM_ProxyEntrypoint = await Factory__OVM_ProxyEntrypoint.deploy()
  })
  it(`should init the proxy with owner and implementation`, async () => {
    await callPrecompile(Helper_PrecompileCaller, OVM_ProxyEntrypoint, 'init', [
      OVM_SequencerEntrypoint.address,
      await wallet.getAddress(),
    ])

    expect(await OVM_ProxyEntrypoint.owner()).to.equal(
      await wallet.getAddress()
    )

    expect(await OVM_ProxyEntrypoint.implementation()).to.equal(
      OVM_SequencerEntrypoint.address
    )
  })
  it(`should revert if proxy has already been inited`, async () => {
    await callPrecompile(Helper_PrecompileCaller, OVM_ProxyEntrypoint, 'init', [
      OVM_SequencerEntrypoint.address,
      await wallet.getAddress(),
    ])

    await callPrecompile(Helper_PrecompileCaller, OVM_ProxyEntrypoint, 'init', [
      ZERO_ADDRESS,
      ZERO_ADDRESS,
    ])

    const ovmREVERT: any = Mock__OVM_ExecutionManager.smocked.ovmREVERT.calls[0]
    expect(ethers.utils.toUtf8String(ovmREVERT._data)).to.equal(
      'ProxyEntrypoint has already been inited'
    )
  })

  it(`should allow owner to upgrade Entrypoint`, async () => {
    await callPrecompile(Helper_PrecompileCaller, OVM_ProxyEntrypoint, 'init', [
      OVM_SequencerEntrypoint.address,
      await wallet.getAddress(),
    ])
    await callPrecompile(
      Helper_PrecompileCaller,
      OVM_ProxyEntrypoint,
      'upgradeEntrypoint',
      [`0x${'12'.repeat(20)}`]
    )
    expect(await OVM_ProxyEntrypoint.implementation()).to.equal(
      `0x${'12'.repeat(20)}`
    )
  })

  it(`should revert if non-owner tries to upgrade Entrypoint`, async () => {
    await callPrecompile(
      Helper_PrecompileCaller,
      OVM_ProxyEntrypoint,
      'upgradeEntrypoint',
      [`0x${'12'.repeat(20)}`]
    )
    const ovmREVERT: any = Mock__OVM_ExecutionManager.smocked.ovmREVERT.calls[0]
    expect(ethers.utils.toUtf8String(ovmREVERT._data)).to.equal(
      'only owner can upgrade the Entrypoint'
    )
  })

  it(`successfully calls ovmCREATEEOA through Entrypoint fallback`, async () => {
    await callPrecompile(Helper_PrecompileCaller, OVM_ProxyEntrypoint, 'init', [
      OVM_SequencerEntrypoint.address,
      await wallet.getAddress(),
    ])

    const calldata = await encodeSequencerCalldata(wallet, DEFAULT_EIP155_TX, 0)

    await Helper_PrecompileCaller.callPrecompile(
      OVM_ProxyEntrypoint.address,
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
