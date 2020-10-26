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

describe.only('ProxyDecompressor', () => {
  let signer: Signer
  before(async () => {
    ;[signer] = await ethers.getSigners()
  })

  let Factory__ProxyDecompressor: ContractFactory
  before(async () => {
    Factory__ProxyDecompressor = await ethers.getContractFactory(
      'ProxyDecompressor'
    )
  })

  let Mock__OVM_ExecutionManager: MockContract
  let Helper_PrecompileCaller: Contract
  let Mock__SequencerMessageDecompressor: MockContract
  before(async () => {
    Mock__OVM_ExecutionManager = smockit(
      await ethers.getContractFactory('OVM_ExecutionManager')
    )

    Mock__OVM_ExecutionManager.smocked.ovmCREATEEOA.will.return.with(
      (msgHash, v, r, s) => {
        console.log('inside smocked ovmCREATEEOA', msgHash, v, r, s)
      }
    )
    Mock__OVM_ExecutionManager.smocked.ovmCALLER.will.return.with(
      await signer.getAddress()
    )

    Helper_PrecompileCaller = await (
      await ethers.getContractFactory('Helper_PrecompileCaller')
    ).deploy()

    Helper_PrecompileCaller.setTarget(Mock__OVM_ExecutionManager.address)
    Mock__SequencerMessageDecompressor = smockit(
      await ethers.getContractFactory('SequencerMessageDecompressor')
    )
  })

  let ProxyDecompressor: Contract
  beforeEach(async () => {
    ProxyDecompressor = await Factory__ProxyDecompressor.deploy()
  })
  it(`should init the proxy with owner and implementation`, async () => {
    await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
      Mock__SequencerMessageDecompressor.address,
      await signer.getAddress(),
    ])

    expect(await ProxyDecompressor.owner()).to.equal(await signer.getAddress())

    expect(await ProxyDecompressor.implementation()).to.equal(
      Mock__SequencerMessageDecompressor.address
    )
  })

  it(`upgrade Decompressor`, async () => {
    await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
      Mock__SequencerMessageDecompressor.address,
      await signer.getAddress(),
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
})
