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
  const [v, r, s] = getRawSignedComponents(transactionSignature).map(
    (component) => {
      return remove0x(component)
    }
  )
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
  console.log('msg hash:', messageHash)
  let [v, r, s] = getSignedComponents(transactionSignature).map(
    (component) => {
      return remove0x(component)
    }
  )
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
  let calldata = `0x0${transactionType}${sig.v}${sig.r}${sig.s}`
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

  // let ECDSAContractAccountPrototype: Contract
  // before(async () => {
  //   ECDSAContractAccountPrototype = resolver.contracts.ecdsaContractAccount
  // })

  let Mock__TargetContract: MockContract
  before(async () => {
    Mock__TargetContract = smockit(
      await ethers.getContractFactory('OVM_ECDSAContractAccount'),
      ethers.provider,
      await wallet.getAddress()
    )
    console.log(Mock__TargetContract.address, await wallet.getAddress())
  })


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
    it('should call EIP155 if the transaction type is zero', async () => {
      const data = '0x000ea82463e3d7063d35b1dd0e9861fb99e299e886aa8bfbf901fa315e96af0eb55e058ca6556d6e3f6a6197385748abe05223c648102161e8c2eaa2e28154444f000001f4000064000064121212121212121212121212121212121212121299999999999999999999'
      await wallet.sendTransaction({
        to: SequencerMessageDecompressor.address,
        data,
      })

      // const calldata = await encodeSequencerCalldata(
      //   wallet,
      //   {
      //     to: await wallet.getAddress(),
      //     nonce: 100,
      //     gasLimit: 500,
      //     gasPrice: 100000000,
      //     data: `0x${'99'.repeat(10)}`,
      //     chainId: 420,
      //   },
      //   0
      // )
    })

    it('should call an ovmCreateEOA when the transaction type is 1', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        {
          to: await wallet.getAddress(),
          nonce: 100,
          gasLimit: 500,
          gasPrice: 100000000,
          data: `0x${'99'.repeat(10)}`,
          chainId: 420,
        },
        2
      )
      const data = '0x010ea82463e3d7063d35b1dd0e9861fb99e299e886aa8bfbf901fa315e96af0eb55e058ca6556d6e3f6a6197385748abe05223c648102161e8c2eaa2e28154444f00c5a152bb84e35f359ea18fb2e8e9ba4eb5587452e43627e8c2820a8e17c69533'
      //TODO sign some dummy tx data (or even better us the message hash from the above sendTransaction)
      await wallet.sendTransaction({
        to: SequencerMessageDecompressor.address,
        data,
      })
    })

    it.only('should submit ETHSignedTypedData if TransactionType is 1', async () => {
      const calldata = await encodeSequencerCalldata(
        wallet,
        {
          to: await wallet.getAddress(),
          nonce: 100,
          gasLimit: 500,
          gasPrice: 100000000,
          data: `0x${'99'.repeat(10)}`,
          chainId: 420,
        },
        1
      )
    })
  })
})
