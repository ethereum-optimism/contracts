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
  DEFAULT_EIP155_TX,
  serializeNativeTransaction,
  serializeEthSignTransaction,
  ZERO_ADDRESS,
} from '../../../helpers'
import { smockit, MockContract } from '@eth-optimism/smock'
import { create } from 'lodash'

describe('OVM_SequencerMessageDecompressor', () => {
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

    Mock__OVM_ExecutionManager.smocked.ovmCHAINID.will.return.with(420)
    Mock__OVM_ExecutionManager.smocked.ovmCALL.will.return.with([true, '0x'])

    Helper_PrecompileCaller = await (
      await ethers.getContractFactory('Helper_PrecompileCaller')
    ).deploy()

    Helper_PrecompileCaller.setTarget(Mock__OVM_ExecutionManager.address)
  })

  let OVM_SequencerMessageDecompressorFactory: ContractFactory
  before(async () => {
    OVM_SequencerMessageDecompressorFactory = await ethers.getContractFactory(
      'OVM_SequencerMessageDecompressor'
    )
  })

  let OVM_SequencerMessageDecompressor: Contract
  beforeEach(async () => {
    OVM_SequencerMessageDecompressor = await OVM_SequencerMessageDecompressorFactory.deploy()
  })

  describe('fallback()', async () => {
    it('should call EIP155 if the transaction type is 0', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        DEFAULT_EIP155_TX,
        0
      )
      await Helper_PrecompileCaller.callPrecompile(
        OVM_SequencerMessageDecompressor.address,
        calldata
      )

      const encodedTx = serializeNativeTransaction(DEFAULT_EIP155_TX)
      const sig = await signNativeTransaction(wallet, DEFAULT_EIP155_TX)

      const expectedEOACalldata = getContractInterface(
        'OVM_ECDSAContractAccount'
      ).encodeFunctionData('execute', [
        encodedTx,
        0, //isEthSignedMessage
        `0x${sig.v}`, //v
        `0x${sig.r}`, //r
        `0x${sig.s}`, //s
      ])
      const ovmCALL: any = Mock__OVM_ExecutionManager.smocked.ovmCALL.calls[0]
      expect(ovmCALL._address).to.equal(await wallet.getAddress())
      expect(ovmCALL._calldata).to.equal(expectedEOACalldata)
    })

    it('should send correct calldata if tx is a create and the transaction type is 0', async () => {
      const createTx = DEFAULT_EIP155_TX
      createTx.to = ZERO_ADDRESS
      const calldata = await encodeSequencerCalldata(wallet, createTx, 0)
      await Helper_PrecompileCaller.callPrecompile(
        OVM_SequencerMessageDecompressor.address,
        calldata
      )

      const encodedTx = serializeNativeTransaction(createTx)
      const sig = await signNativeTransaction(wallet, createTx)

      const expectedEOACalldata = getContractInterface(
        'OVM_ECDSAContractAccount'
      ).encodeFunctionData('execute', [
        encodedTx,
        0, //isEthSignedMessage
        `0x${sig.v}`, //v
        `0x${sig.r}`, //r
        `0x${sig.s}`, //s
      ])
      const ovmCALL: any = Mock__OVM_ExecutionManager.smocked.ovmCALL.calls[0]
      expect(ovmCALL._address).to.equal(await wallet.getAddress())
      expect(ovmCALL._calldata).to.equal(expectedEOACalldata)
    })

    it('should call an ovmCreateEOA when the transaction type is 1', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        DEFAULT_EIP155_TX,
        1
      )
      await Helper_PrecompileCaller.callPrecompile(
        OVM_SequencerMessageDecompressor.address,
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

    it('should submit ETHSignedTypedData if TransactionType is 2', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        DEFAULT_EIP155_TX,
        2
      )
      await Helper_PrecompileCaller.callPrecompile(
        OVM_SequencerMessageDecompressor.address,
        calldata
      )

      const encodedTx = serializeEthSignTransaction(DEFAULT_EIP155_TX)
      const sig = await signEthSignMessage(wallet, DEFAULT_EIP155_TX)

      const expectedEOACalldata = getContractInterface(
        'OVM_ECDSAContractAccount'
      ).encodeFunctionData('execute', [
        encodedTx,
        1, //isEthSignedMessage
        `0x${sig.v}`, //v
        `0x${sig.r}`, //r
        `0x${sig.s}`, //s
      ])
      const ovmCALL: any = Mock__OVM_ExecutionManager.smocked.ovmCALL.calls[0]
      expect(ovmCALL._address).to.equal(await wallet.getAddress())
      expect(ovmCALL._calldata).to.equal(expectedEOACalldata)
    })

    it('should revert if TransactionType is >2', async () => {
      const calldata = '0x03'
      await expect(
        Helper_PrecompileCaller.callPrecompile(
          OVM_SequencerMessageDecompressor.address,
          calldata
        )
      ).to.be.revertedWith('Transaction type must be 0, 1, or 2')
    })
  })
})
