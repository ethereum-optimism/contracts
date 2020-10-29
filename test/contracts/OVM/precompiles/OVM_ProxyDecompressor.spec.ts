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

describe('OVM_ProxyDecompressor', () => {
  let wallet: Wallet
  before(async () => {
    const provider = waffle.provider
    ;[wallet] = provider.getWallets()
  })

  let Factory__OVM_ProxyDecompressor: ContractFactory
  before(async () => {
    Factory__OVM_ProxyDecompressor = await ethers.getContractFactory(
      'OVM_ProxyDecompressor'
    )
  })

  let Mock__OVM_ExecutionManager: MockContract
  let Helper_PrecompileCaller: Contract
  let OVM_SequencerMessageDecompressor: Contract
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

    OVM_SequencerMessageDecompressor = await (
      await ethers.getContractFactory('OVM_SequencerMessageDecompressor')
    ).deploy()
  })

  let OVM_ProxyDecompressor: Contract
  beforeEach(async () => {
    OVM_ProxyDecompressor = await Factory__OVM_ProxyDecompressor.deploy()
  })
  it(`should init the proxy with owner and implementation`, async () => {
    await callPrecompile(
      Helper_PrecompileCaller,
      OVM_ProxyDecompressor,
      'init',
      [OVM_SequencerMessageDecompressor.address, await wallet.getAddress()]
    )

    expect(await OVM_ProxyDecompressor.owner()).to.equal(
      await wallet.getAddress()
    )

    expect(await OVM_ProxyDecompressor.implementation()).to.equal(
      OVM_SequencerMessageDecompressor.address
    )
  })

  it(`should allow owner to upgrade Decompressor`, async () => {
    await callPrecompile(
      Helper_PrecompileCaller,
      OVM_ProxyDecompressor,
      'init',
      [OVM_SequencerMessageDecompressor.address, await wallet.getAddress()]
    )
    await callPrecompile(
      Helper_PrecompileCaller,
      OVM_ProxyDecompressor,
      'upgradeDecompressor',
      [`0x${'12'.repeat(20)}`]
    )
    expect(await OVM_ProxyDecompressor.implementation()).to.equal(
      `0x${'12'.repeat(20)}`
    )
  })

  it(`should revert if non-owner tries to upgrade Decompressor`, async () => {
    await expect(
      callPrecompile(
        Helper_PrecompileCaller,
        OVM_ProxyDecompressor,
        'upgradeDecompressor',
        [`0x${'12'.repeat(20)}`]
      )
    ).to.be.revertedWith('only owner can upgrade the decompressor')
    expect(await OVM_ProxyDecompressor.implementation()).to.equal(ZERO_ADDRESS)
  })

  it(`successfully calls ovmCREATEEOA through decompressor fallback`, async () => {
    await callPrecompile(
      Helper_PrecompileCaller,
      OVM_ProxyDecompressor,
      'init',
      [OVM_SequencerMessageDecompressor.address, await wallet.getAddress()]
    )

    const calldata = await encodeSequencerCalldata(wallet, DEFAULT_EIP155_TX, 0)

    await Helper_PrecompileCaller.callPrecompile(
      OVM_ProxyDecompressor.address,
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
