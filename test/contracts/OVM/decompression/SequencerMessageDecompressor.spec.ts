import { expect } from '../../../setup'

/* External Imports */
import { ethers } from '@nomiclabs/buidler'
import { ContractFactory, Signer, Contract } from 'ethers'
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
  signer: Signer,
  transaction: EOATransaction
): Promise<SignatureParameters> => {
  const serializedTransaction = serializeEthSignTransaction(transaction)
  const transactionHash = ethers.utils.keccak256(serializedTransaction)
  const transactionHashBytes = ethers.utils.arrayify(transactionHash)
  const transactionSignature = await signer.signMessage(transactionHashBytes)

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
  signer: Signer,
  transaction: EOATransaction
): Promise<SignatureParameters> => {
  const serializedTransaction = serializeNativeTransaction(transaction)
  const transactionSignature = await signer.signTransaction(transaction)

  const messageHash = ethers.utils.keccak256(serializedTransaction)
  const [v, r, s] = getSignedComponents(transactionSignature).map(
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

const signTransaction = async (
  signer: Signer,
  transaction: EOATransaction,
  transactionType: number
): Promise<SignatureParameters> => {
  return transactionType === 2
    ? signEthSignMessage(signer, transaction)
    : signNativeTransaction(signer, transaction)
}

const encodeSequencerCalldata = async (
  signer: Signer,
  transaction: EOATransaction,
  transactionType: number
) => {
  const sig = await signTransaction(signer, transaction, transactionType)
  const encodedTransaction = encodeCompactTransaction(transaction)

  let calldata = `0x0${transactionType}${sig.v}${sig.r}${sig.s}`
  if (transactionType === 0) {
    calldata = `${calldata}${remove0x(sig.messageHash)}`
  } else {
    calldata = `${calldata}${encodedTransaction}`
  }

  return calldata
}

describe('SequencerMessageDecompressor', () => {
  let signer: Signer
  before(async () => {
    ;[signer] = await ethers.getSigners()
  })

  // let ECDSAContractAccountPrototype: Contract
  // before(async () => {
  //   ECDSAContractAccountPrototype = resolver.contracts.ecdsaContractAccount
  // })

  let Mock__TargetContract: MockContract
  before(async () => {
    Mock__TargetContract = smockit(
      await ethers.getContractFactory('Helper_SimpleProxy')
    )
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
    it('should call ovmCREATEEOA if the transaction type is zero', async () => {
      const calldata = await encodeSequencerCalldata(
        signer,
        {
          to: await signer.getAddress(),
          nonce: 1,
          gasLimit: 2000000,
          gasPrice: 0,
          data: '0x',
          chainId: 420,
        },
        0
      )

      // await executeTransaction(
      //   ExecutionManger,
      //   signer,
      //   SequencerMessageDecompressorAddress,
      //   calldata,
      //   true
      // )

      // const ecdsaPrototypeBytecode = await ethers.provider.getCode(
      //   ECDSAContractAccountPrototype.address
      // )
      // const codeContractAddress = await StateManager.ovmAddressToCodeContractAddress(
      //   await signer.getAddress()
      // )
      // const codeContractBytecode = await ethers.provider.getCode(
      //   codeContractAddress
      // )

      // expect(codeContractAddress).to.not.equal(ZERO_ADDRESS)
      // expect(codeContractBytecode).to.equal(ecdsaPrototypeBytecode)
    })

  //   it('should call an ECDSAContractAccount when the transaction type is 1', async () => {
  //     const ovmCREATEEOAcalldata = await encodeSequencerCalldata(
  //       signer,
  //       {
  //         to: signer.address,
  //         nonce: 1,
  //         gasLimit: 2000000,
  //         gasPrice: 0,
  //         data: '0x',
  //         chainId: 108,
  //       },
  //       0
  //     )

  //     await executeTransaction(
  //       ExecutionManger,
  //       signer,
  //       SequencerMessageDecompressorAddress,
  //       ovmCREATEEOAcalldata,
  //       true
  //     )

  //     const expectedKey = ethers.utils.keccak256('0x1234')
  //     const expectedVal = ethers.utils.keccak256('0x5678')

  //     const calldata = await encodeSequencerCalldata(
  //       signer,
  //       {
  //         to: SimpleStorageAddress,
  //         nonce: 5,
  //         gasLimit: 2000000,
  //         gasPrice: 0,
  //         chainId: 108,
  //         data: SimpleStorageFactory.interface.encodeFunctionData(
  //           'setStorage',
  //           [expectedKey, expectedVal]
  //         ),
  //       },
  //       1
  //     )

  //     await executeTransaction(
  //       ExecutionManger,
  //       signer,
  //       SequencerMessageDecompressorAddress,
  //       calldata,
  //       true
  //     )

  //     const codeContractAddress = await StateManager.ovmAddressToCodeContractAddress(
  //       SimpleStorageAddress
  //     )
  //     const SimpleStorage = SimpleStorageFactory.attach(codeContractAddress)
  //     const actualVal = await SimpleStorage.getStorage(expectedKey)
  //     expect(actualVal).to.equal(expectedVal)
  //   })

  //   it('should call an ECDSAContractAccount when the transaction type is 2', async () => {
  //     const ovmCREATEEOAcalldata = await encodeSequencerCalldata(
  //       signer,
  //       {
  //         to: signer.address,
  //         nonce: 1,
  //         gasLimit: 2000000,
  //         gasPrice: 0,
  //         data: '0x',
  //         chainId: 108,
  //       },
  //       0
  //     )

  //     await executeTransaction(
  //       ExecutionManger,
  //       signer,
  //       SequencerMessageDecompressorAddress,
  //       ovmCREATEEOAcalldata,
  //       true
  //     )

  //     const expectedKey = ethers.utils.keccak256('0x1234')
  //     const expectedVal = ethers.utils.keccak256('0x5678')

  //     const calldata = await encodeSequencerCalldata(
  //       signer,
  //       {
  //         to: SimpleStorageAddress,
  //         nonce: 5,
  //         gasLimit: 2000000,
  //         gasPrice: 0,
  //         chainId: 108,
  //         data: SimpleStorageFactory.interface.encodeFunctionData(
  //           'setStorage',
  //           [expectedKey, expectedVal]
  //         ),
  //       },
  //       2
  //     )

  //     await executeTransaction(
  //       ExecutionManger,
  //       signer,
  //       SequencerMessageDecompressorAddress,
  //       calldata,
  //       true
  //     )

  //     const codeContractAddress = await StateManager.ovmAddressToCodeContractAddress(
  //       SimpleStorageAddress
  //     )
  //     const SimpleStorage = SimpleStorageFactory.attach(codeContractAddress)
  //     const actualVal = await SimpleStorage.getStorage(expectedKey)
  //     expect(actualVal).to.equal(expectedVal)
  //   })
  })
})