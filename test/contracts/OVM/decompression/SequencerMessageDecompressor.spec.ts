import { expect } from '../../../setup'

/* External Imports */
import { waffle, ethers } from '@nomiclabs/buidler'
import { ContractFactory, Wallet, Contract } from 'ethers'
import { zeroPad } from '@ethersproject/bytes'
import {
  remove0x,
  numberToHexString,
  hexStrToBuf,
  makeAddressManager,
} from '../../../helpers'
import { smockit, MockContract } from '@eth-optimism/smock'

interface EOATransaction {
  nonce: number
  gasLimit: number
  gasPrice: number
  to: string
  data: string
  chainId: number
}

interface SignatureParameters {
  messageHash: string
  v: string
  r: string
  s: string
}

export const getRawSignedComponents = (signed: string): any[] => {
  return [signed.slice(130, 132), signed.slice(2, 66), signed.slice(66, 130)]
}

export const getSignedComponents = (signed: string): any[] => {
  return ethers.utils.RLP.decode(signed).slice(-3)
}

const encodeCompactTransaction = (transaction: any): string => {
  const nonce = zeroPad(transaction.nonce, 3)
  const gasLimit = zeroPad(transaction.gasLimit, 3)
  if (transaction.gasPrice % 1000000 !== 0)
    throw Error('gas price must be a multiple of 1000000')
  const compressedGasPrice: any = transaction.gasPrice / 1000000
  const gasPrice = zeroPad(compressedGasPrice, 3)
  const to = hexStrToBuf(transaction.to)
  const data = hexStrToBuf(transaction.data)

  return Buffer.concat([
    Buffer.from(gasLimit),
    Buffer.from(gasPrice),
    Buffer.from(nonce),
    Buffer.from(to),
    data,
  ]).toString('hex')
}

const serializeEthSignTransaction = (transaction: EOATransaction): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'address', 'bytes'],
    [
      transaction.nonce,
      transaction.gasLimit,
      transaction.gasPrice,
      transaction.chainId,
      transaction.to,
      transaction.data,
    ]
  )
}

const serializeNativeTransaction = (transaction: EOATransaction): string => {
  return ethers.utils.serializeTransaction(transaction)
}

const signEthSignMessage = async (
  wallet: Wallet,
  transaction: EOATransaction
): Promise<SignatureParameters> => {
  const serializedTransaction = serializeEthSignTransaction(transaction)
  const transactionHash = ethers.utils.keccak256(serializedTransaction)
  const transactionHashBytes = ethers.utils.arrayify(transactionHash)
  const transactionSignature = await wallet.signMessage(transactionHashBytes)

  const messageHash = ethers.utils.hashMessage(transactionHashBytes)
  let [v, r, s] = getRawSignedComponents(transactionSignature).map(
    (component) => {
      return remove0x(component)
    }
  )
  v = '0' + (parseInt(v, 16) - 27)
  return {
    messageHash,
    v,
    r,
    s,
  }
}

const signNativeTransaction = async (
  wallet: Wallet,
  transaction: EOATransaction
): Promise<SignatureParameters> => {
  const serializedTransaction = serializeNativeTransaction(transaction)
  const transactionSignature = await wallet.signTransaction(transaction)

  const messageHash = ethers.utils.keccak256(serializedTransaction)
  let [v, r, s] = getSignedComponents(transactionSignature).map((component) => {
    return remove0x(component)
  })
  v = '0' + (parseInt(v, 16) - 420 * 2 - 8 - 27)
  return {
    messageHash,
    v,
    r,
    s,
  }
}

const signTransaction = async (
  wallet: Wallet,
  transaction: EOATransaction,
  transactionType: number
): Promise<SignatureParameters> => {
  return transactionType === 2
    ? signEthSignMessage(wallet, transaction)
    : signNativeTransaction(wallet, transaction)
}

const encodeSequencerCalldata = async (
  wallet: Wallet,
  transaction: EOATransaction,
  transactionType: number
) => {
  const sig = await signTransaction(wallet, transaction, transactionType)
  const encodedTransaction = encodeCompactTransaction(transaction)
  const dataPrefix = `0x0${transactionType}${sig.r}${sig.s}${sig.v}`
  const calldata =
    transactionType === 1
      ? `${dataPrefix}${remove0x(sig.messageHash)}`
      : `${dataPrefix}${encodedTransaction}`
  return calldata
}

describe.only('SequencerMessageDecompressor', () => {
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

    Mock__OVM_ExecutionManager.smocked.ovmCREATEEOA.will.return.with(
      (msgHash, _v, _r, _s) => {
        console.log(
          'ovmCREATEEOA creates EOA at:',
          ethers.utils.recoverAddress(msgHash, {
            v: _v + 27,
            r: _r,
            s: _s,
          })
        )
      }
    )
    Mock__OVM_ExecutionManager.smocked.ovmCHAINID.will.return.with(420)
    Mock__OVM_ExecutionManager.smocked.ovmCALL.will.return.with(
      (_gasLimit, _target, _calldata) => {
        console.log(
          'Performing call to',
          _target,
          'with gasLimit:',
          _gasLimit.toString(),
          'and calldata:',
          _calldata
        )
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
    SequencerMessageDecompressor = await SequencerMessageDecompressorFactory.deploy()
  })

  describe('fallback()', async () => {
    it('should call EIP155 if the transaction type is 0', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        {
          to: `0x${'12'.repeat(20)}`,
          nonce: 100,
          gasLimit: 500,
          gasPrice: 100000000,
          data: `0x${'99'.repeat(10)}`,
          chainId: 420,
        },
        0
      )
      await Helper_PrecompileCaller.callPrecompile(
        SequencerMessageDecompressor.address,
        calldata
      )
      console.log('expected target:', await wallet.getAddress())
    })

    it('should call an ovmCreateEOA when the transaction type is 1', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        {
          to: `0x${'12'.repeat(20)}`,
          nonce: 100,
          gasLimit: 500,
          gasPrice: 100000000,
          data: `0x${'99'.repeat(10)}`,
          chainId: 420,
        },
        1
      )
      await Helper_PrecompileCaller.callPrecompile(
        SequencerMessageDecompressor.address,
        calldata
      )

      console.log('expected EOA:', await wallet.getAddress())
    })

    it('should submit ETHSignedTypedData if TransactionType is 2', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        {
          to: `0x${'12'.repeat(20)}`,
          nonce: 100,
          gasLimit: 500,
          gasPrice: 100000000,
          data: `0x${'99'.repeat(10)}`,
          chainId: 420,
        },
        2
      )

      await Helper_PrecompileCaller.callPrecompile(
        SequencerMessageDecompressor.address,
        calldata
      )
      console.log('expected target:', await wallet.getAddress())
    })
  })
})
