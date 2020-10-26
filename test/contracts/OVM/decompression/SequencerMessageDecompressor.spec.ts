import { expect } from '../../../setup'

/* External Imports */
import { waffle, ethers } from '@nomiclabs/buidler'
import { ContractFactory, Wallet, Contract } from 'ethers'
import { zeroPad } from '@ethersproject/bytes'
import { getContractInterface } from '../../../../src'
import {
  encodeSequencerCalldata,
  EIP155Transaction,
  signNativeTransaction,
  signEthSignMessage,
} from '../../../helpers'
import { smockit, MockContract } from '@eth-optimism/smock'

const DEFAULT_TX: EIP155Transaction = {
  to: `0x${'12'.repeat(20)}`,
  nonce: 100,
  gasLimit: 500,
  gasPrice: 100000000,
  data: `0x${'99'.repeat(10)}`,
  chainId: 420,
}

describe.only('SequencerMessageDecompressor', () => {
  let wallet: Wallet
  let eoaAddress: string
  let ovmCall: any
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

    Mock__OVM_ExecutionManager.smocked.ovmCREATEEOA.will.return.with(
      (msgHash, _v, _r, _s) => {
        eoaAddress = ethers.utils.recoverAddress(msgHash, {
          v: _v + 27,
          r: _r,
          s: _s,
        })
      }
    )
    Mock__OVM_ExecutionManager.smocked.ovmCHAINID.will.return.with(420)
    Mock__OVM_ExecutionManager.smocked.ovmCALL.will.return.with(
      (_gasLimit, _target, _calldata) => {
        ovmCall.target = _target
        ovmCall.gasLimit = _gasLimit
        ovmCall.calldata = _calldata
        return [true, '0x']
      }
    )

    Helper_PrecompileCaller = await (
      await ethers.getContractFactory('Helper_PrecompileCaller')
    ).deploy()

    Helper_PrecompileCaller.setTarget(Mock__OVM_ExecutionManager.address)
  })

  let SequencerMessageDecompressorFactory: ContractFactory
  before(async () => {
    SequencerMessageDecompressorFactory = await ethers.getContractFactory(
      'SequencerMessageDecompressor'
    )
  })

  let SequencerMessageDecompressor: Contract
  beforeEach(async () => {
    eoaAddress = '0x'
    ovmCall = {
      target: '0x',
      gasLimit: 0,
      calldata: '0x',
    }
    SequencerMessageDecompressor = await SequencerMessageDecompressorFactory.deploy()
  })

  describe('fallback()', async () => {
    it('should call EIP155 if the transaction type is 0', async () => {
      const calldata = await encodeSequencerCalldata(wallet, DEFAULT_TX, 0)
      await Helper_PrecompileCaller.callPrecompile(
        SequencerMessageDecompressor.address,
        calldata
      )

      const message = `0x${calldata.slice(67 * 2)}`
      const sig = await signNativeTransaction(wallet, DEFAULT_TX)

      const expectedEOACalldata = getContractInterface(
        'OVM_ECDSAContractAccount'
      ).encodeFunctionData('execute', [
        message,
        0, //isEthSignedMessage
        `0x${sig.v}`, //v
        `0x${sig.r}`, //r
        `0x${sig.s}`, //s
      ])
      expect(ovmCall.target).to.equal(await wallet.getAddress())
      expect(ovmCall.calldata).to.equal(expectedEOACalldata)
    })

    it('should call an ovmCreateEOA when the transaction type is 1', async () => {
      const calldata = await encodeSequencerCalldata(wallet, DEFAULT_TX, 1)
      await Helper_PrecompileCaller.callPrecompile(
        SequencerMessageDecompressor.address,
        calldata
      )
      expect(eoaAddress).to.equal(await wallet.getAddress())
    })

    it('should submit ETHSignedTypedData if TransactionType is 2', async () => {
      const calldata = await encodeSequencerCalldata(wallet, DEFAULT_TX, 2)
      await Helper_PrecompileCaller.callPrecompile(
        SequencerMessageDecompressor.address,
        calldata
      )

      const message = `0x${calldata.slice(67 * 2)}`
      const sig = await signEthSignMessage(wallet, DEFAULT_TX)

      const expectedEOACalldata = getContractInterface(
        'OVM_ECDSAContractAccount'
      ).encodeFunctionData('execute', [
        message,
        1, //isEthSignedMessage
        `0x${sig.v}`, //v
        `0x${sig.r}`, //r
        `0x${sig.s}`, //s
      ])
      expect(ovmCall.target).to.equal(await wallet.getAddress())
      expect(ovmCall.calldata).to.equal(expectedEOACalldata)
    })

    it('should revert if TransactionType is >2', async () => {
      const calldata = '0x03'
      await expect(
        Helper_PrecompileCaller.callPrecompile(
          SequencerMessageDecompressor.address,
          calldata
        )
      ).to.be.revertedWith('Transaction type must be 0, 1, or 2')
    })
  })
})
