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
  const nonce = zeroPad(transaction.nonce, 2)
  const gasLimit = zeroPad(transaction.gasLimit, 3)
  const gasPrice = zeroPad(transaction.gasPrice, 1)
  const chainId = zeroPad(transaction.chainId, 4)
  const to = hexStrToBuf(transaction.to)
  const data = hexStrToBuf(transaction.data)

  return Buffer.concat([
    Buffer.from(nonce),
    Buffer.from(gasLimit),
    Buffer.from(gasPrice),
    chainId,
    to,
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
  // const encodedTransaction = encodeCompactTransaction(transaction)
  console.log(`SIG!!${sig.r}${sig.s}${sig.v}`)
  let calldata = `0x0${transactionType}${sig.r}${sig.s}${sig.v}`
  // if (transactionType === 0) {
  //   calldata = `${calldata}${remove0x(sig.messageHash)}`
  // } else {
  //   calldata = `${calldata}${encodedTransaction}`
  // }

  return calldata
}

describe.only('SequencerMessageDecompressor', () => {
  let wallet: Wallet
  before(async () => {
    const provider = waffle.provider
    ;[wallet] = provider.getWallets()
  })

  // let Mock__TargetContract: MockContract
  // before(async () => {
  //   Mock__TargetContract = smockit(
  //     await ethers.getContractFactory('OVM_ECDSAContractAccount'),
  //     ethers.provider,
  //     await wallet.getAddress()
  //   )
  // })

  let SequencerMessageDecompressorFactory: ContractFactory
  before(async () => {
    SequencerMessageDecompressorFactory = await ethers.getContractFactory(
      'SequencerMessageDecompressor'
    )
  })

  // let SequencerMessageDecompressorAddress: string
  let SequencerMessageDecompressor: Contract
  beforeEach(async () => {
    SequencerMessageDecompressor = await SequencerMessageDecompressorFactory.deploy()
  })

  describe('fallback()', async () => {
    it('should call EIP155 if the transaction type is 0', async () => {
      // const calldata = await encodeSequencerCalldata(
      //   wallet,
      //   {
      //     to: `0x${'12'.repeat(20)}`,
      //     nonce: 100,
      //     gasLimit: 500,
      //     gasPrice: 100000000,
      //     data: `0x${'99'.repeat(10)}`,
      //     chainId: 420,
      //   },
      //   0
      // )
      const data =
        '0x0073757c671fae2c3fb6825766c724b7715720bda4b309d3612f2c6233645569672fc9b7222783390b9f10e22e92a52871beaff2613193d6e2dbf18d0e2d2eb8ff010001f4000064000064121212121212121212121212121212121212121299999999999999999999'
      await wallet.sendTransaction({
        to: SequencerMessageDecompressor.address,
        data,
      })
      console.log('expected target:', await wallet.getAddress())
    })

    it('should call an ovmCreateEOA when the transaction type is 1', async () => {
      // const calldata = await encodeSequencerCalldata(
      //   wallet,
      //   {
      //     to: `0x${'12'.repeat(20)}`,
      //     nonce: 100,
      //     gasLimit: 500,
      //     gasPrice: 100000000,
      //     data: `0x${'99'.repeat(10)}`,
      //     chainId: 420,
      //   },
      //   1
      // )
      const data =
        '0x010ea82463e3d7063d35b1dd0e9861fb99e299e886aa8bfbf901fa315e96af0eb55e058ca6556d6e3f6a6197385748abe05223c648102161e8c2eaa2e28154444f00c5a152bb84e35f359ea18fb2e8e9ba4eb5587452e43627e8c2820a8e17c69533'
      await wallet.sendTransaction({
        to: SequencerMessageDecompressor.address,
        data,
      })

      console.log('expected EOA:', await wallet.getAddress())
    })

    it('should submit ETHSignedTypedData if TransactionType is 2', async () => {
      // const calldata = await encodeSequencerCalldata(
      //   wallet,
      //   {
      //     to: `0x${'12'.repeat(20)}`,
      //     nonce: 100,
      //     gasLimit: 500,
      //     gasPrice: 100000000,
      //     data: `0x${'99'.repeat(10)}`,
      //     chainId: 420,
      //   },
      //   2
      // )
      const data =
        '0x02e76b8f3752708d221f0b4692eefc2e4c92e28612e5334769b1271c81ba11cbc06a76a9653196f01f36281530934a753ea33246db3abfff9edd86d5a2e241ca23010001f4000064000064121212121212121212121212121212121212121299999999999999999999'
      await wallet.sendTransaction({
        to: SequencerMessageDecompressor.address,
        data,
      })
      console.log('expected target:', await wallet.getAddress())
    })
  })
})
