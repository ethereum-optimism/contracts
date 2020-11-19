import { ZERO_ADDRESS, NULL_BYTES32 } from '../constants'
import { ethers } from 'ethers'

export interface Transaction {
    timestamp: number,
    blockNumber: number
    l1QueueOrigin: number,
    l1TxOrigin: string,
    entrypoint: string,
    gasLimit: number,
    data: string,
}

export const DUMMY_OVM_TRANSACTIONS: Array<Transaction> = [
  {
    timestamp: 0,
    blockNumber: 0,
    l1QueueOrigin: 0,
    l1TxOrigin: ZERO_ADDRESS,
    entrypoint: ZERO_ADDRESS,
    gasLimit: 0,
    data: NULL_BYTES32,
  },
]

export const hashTransaction = ({ timestamp, blockNumber, l1QueueOrigin, l1TxOrigin, entrypoint, gasLimit, data }: Transaction): string => {
  return ethers.utils.solidityKeccak256(
    ['uint256', 'uint256', 'uint8', 'address', 'address', 'uint256', 'bytes'],
    [timestamp, blockNumber, l1QueueOrigin, l1TxOrigin, entrypoint, gasLimit, data]
  )
}
