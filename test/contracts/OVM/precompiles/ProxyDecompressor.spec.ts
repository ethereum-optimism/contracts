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

describe('ProxyDecompressor', () => {
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
  })

  let ProxyDecompressor: Contract
  beforeEach(async () => {
    ProxyDecompressor = await Factory__ProxyDecompressor.deploy()
  })

  describe('Unit tests', () => {
    let Mock__SequencerMessageDecompressor: MockContract
    before(async () => {
      Mock__SequencerMessageDecompressor = smockit(
        await ethers.getContractFactory('SequencerMessageDecompressor')
      )
    })

    it(`should init the proxy with owner and implementation`, async () => {
      await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
        Mock__SequencerMessageDecompressor.address,
        await signer.getAddress(),
      ])

      expect(await ProxyDecompressor.owner()).to.equal(
        await signer.getAddress()
      )

      expect(await ProxyDecompressor.implementation()).to.equal(
        Mock__SequencerMessageDecompressor.address
      )
    })

    it(`safeCREATEEOA through proxy`, async () => {
      await callPrecompile(
        Helper_PrecompileCaller,
        ProxyDecompressor,
        'safeCREATEEOA',
        [
          `0x${'99'.repeat(32)}`,
          1,
          `0x${'11'.repeat(32)}`,
          `0x${'22'.repeat(32)}`,
        ]
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

  // describe('Integration tests', () => {
  //   let Factory__SequencerMessageDecompressor: ContractFactory
  //   before(async () => {
  //     Factory__SequencerMessageDecompressor = await ethers.getContractFactory(
  //       'SequencerMessageDecompressor'
  //     )
  //   })

  //   let SequencerMessageDecompressor: Contract
  //   beforeEach(async () => {
  //     SequencerMessageDecompressor = await Factory__SequencerMessageDecompressor.deploy()
  //   })
  //   it(`should init the proxy with owner and implementation`, async () => {
  //     await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
  //       SequencerMessageDecompressor.address,
  //       await signer.getAddress(),
  //     ])

  //     expect(await ProxyDecompressor.owner()).to.equal(
  //       await signer.getAddress()
  //     )

  //     expect(await ProxyDecompressor.implementation()).to.equal(
  //       SequencerMessageDecompressor.address
  //     )
  //   })

  //   it(`safeCREATEEOA through proxy`, async () => {
  //     await callPrecompile(
  //       Helper_PrecompileCaller,
  //       ProxyDecompressor,
  //       'safeCREATEEOA',
  //       [
  //         `0x${'99'.repeat(32)}`,
  //         1,
  //         `0x${'11'.repeat(32)}`,
  //         `0x${'22'.repeat(32)}`,
  //       ]
  //     )
  //   })
  //   it.only(`process compressed createEOA tx through fallback`, async () => {
  //     await callPrecompile(Helper_PrecompileCaller, ProxyDecompressor, 'init', [
  //       SequencerMessageDecompressor.address,
  //       await signer.getAddress(),
  //     ])
  //     const data = '0x010ea82463e3d7063d35b1dd0e9861fb99e299e886aa8bfbf901fa315e96af0eb55e058ca6556d6e3f6a6197385748abe05223c648102161e8c2eaa2e28154444f00c5a152bb84e35f359ea18fb2e8e9ba4eb5587452e43627e8c2820a8e17c69533'
  //     await Helper_PrecompileCaller.callPrecompile(
  //       ProxyDecompressor.address,
  //       data
  //     )
  //   })
  // })
})
