import { expect } from '../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, ContractFactory, Contract, BigNumber, providers } from 'ethers'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { smockit, MockContract } from '@eth-optimism/smock'
import _ from 'lodash'

/* Internal Imports */
import {
  makeAddressManager,
  setProxyTarget,
  FORCE_INCLUSION_PERIOD_SECONDS,
  FORCE_INCLUSION_PERIOD_BLOCKS,
  setEthTime,
  NON_ZERO_ADDRESS,
  remove0x,
  getEthTime,
  getNextBlockNumber,
  increaseEthTime,
  getBlockTime,
  ZERO_ADDRESS,
} from '../../../helpers'
import { defaultAbiCoder, keccak256 } from 'ethers/lib/utils'

const ELEMENT_TEST_SIZES = [1, 2, 4, 8, 16]
const DECOMPRESSION_ADDRESS = '0x4200000000000000000000000000000000000008'
const MAX_GAS_LIMIT = 8_000_000

const getQueueLeafHash = (index: number): string => {
  return keccak256(
    defaultAbiCoder.encode(
      ['bool', 'uint256', 'uint256', 'uint256', 'bytes'],
      [false, index, 0, 0, '0x']
    )
  )
}

const getSequencerLeafHash = (
  timestamp: number,
  blockNumber: number,
  data: string
): string => {
  return keccak256(
    '0x01' +
      remove0x(BigNumber.from(timestamp).toHexString()).padStart(64, '0') +
      remove0x(BigNumber.from(blockNumber).toHexString()).padStart(64, '0') +
      remove0x(data)
  )
}

const getTransactionHash = (
  sender: string,
  target: string,
  gasLimit: number,
  data: string
): string => {
  return keccak256(encodeQueueTransaction(sender, target, gasLimit, data))
}

const encodeQueueTransaction = (
  sender: string,
  target: string,
  gasLimit: number,
  data: string
): string => {
  return defaultAbiCoder.encode(
    ['address', 'address', 'uint256', 'bytes'],
    [sender, target, gasLimit, data]
  )
}

interface BatchContext {
  numSequencedTransactions: number
  numSubsequentQueueTransactions: number
  timestamp: number
  blockNumber: number
}

interface AppendSequencerBatchParams {
  shouldStartAtElement: number // 5 bytes -- starts at batch
  totalElementsToAppend: number // 3 bytes -- total_elements_to_append
  contexts: BatchContext[] // total_elements[fixed_size[]]
  transactions: string[] // total_size_bytes[],total_size_bytes[]
}

const encodeAppendSequencerBatch = (b: AppendSequencerBatchParams): string => {
  const encodedShouldStartAtElement = remove0x(
    BigNumber.from(b.shouldStartAtElement).toHexString()
  ).padStart(10, '0')

  const encodedTotalElementsToAppend = remove0x(
    BigNumber.from(b.totalElementsToAppend).toHexString()
  ).padStart(6, '0')

  const encodedContextsHeader = remove0x(
    BigNumber.from(b.contexts.length).toHexString()
  ).padStart(6, '0')

  const encodedContexts =
    encodedContextsHeader +
    b.contexts.reduce((acc, cur) => acc + encodeBatchContext(cur), '')

  const encodedTransactionData = b.transactions.reduce((acc, cur) => {
    if (cur.length % 2 !== 0)
      throw new Error('Unexpected uneven hex string value!')
    const encodedTxDataHeader = remove0x(
      BigNumber.from(remove0x(cur).length / 2).toHexString()
    ).padStart(6, '0')
    return acc + encodedTxDataHeader + remove0x(cur)
  }, '')

  return (
    encodedShouldStartAtElement +
    encodedTotalElementsToAppend +
    encodedContexts +
    encodedTransactionData
  )
}

const appendSequencerBatch = async (
  OVM_CanonicalTransactionChain: Contract,
  batch: AppendSequencerBatchParams
): Promise<TransactionResponse> => {
  const methodId = keccak256(Buffer.from('appendSequencerBatch()')).slice(2, 10)
  const calldata = encodeAppendSequencerBatch(batch)
  return OVM_CanonicalTransactionChain.signer.sendTransaction({
    to: OVM_CanonicalTransactionChain.address,
    data: '0x' + methodId + calldata,
  })
}

const encodeBatchContext = (context: BatchContext): string => {
  return (
    remove0x(
      BigNumber.from(context.numSequencedTransactions).toHexString()
    ).padStart(6, '0') +
    remove0x(
      BigNumber.from(context.numSubsequentQueueTransactions).toHexString()
    ).padStart(6, '0') +
    remove0x(BigNumber.from(context.timestamp).toHexString()).padStart(
      10,
      '0'
    ) +
    remove0x(BigNumber.from(context.blockNumber).toHexString()).padStart(
      10,
      '0'
    )
  )
}

describe('[GAS BENCHMARK] OVM_CanonicalTransactionChain', () => {
  let signer: Signer
  let sequencer: Signer
  before(async () => {
    ;[signer, sequencer] = await ethers.getSigners()
  })

  let AddressManager: Contract
  let Mock__OVM_ExecutionManager: MockContract
  let Mock__OVM_StateCommitmentChain: MockContract
  before(async () => {
    AddressManager = await makeAddressManager()
    await AddressManager.setAddress(
      'OVM_Sequencer',
      await sequencer.getAddress()
    )
    await AddressManager.setAddress(
      'OVM_DecompressionPrecompileAddress',
      DECOMPRESSION_ADDRESS
    )

    Mock__OVM_ExecutionManager = await smockit(
      await ethers.getContractFactory('OVM_ExecutionManager')
    )

    Mock__OVM_StateCommitmentChain = await smockit(
      await ethers.getContractFactory('OVM_StateCommitmentChain')
    )

    await setProxyTarget(
      AddressManager,
      'OVM_ExecutionManager',
      Mock__OVM_ExecutionManager
    )

    await setProxyTarget(
      AddressManager,
      'OVM_StateCommitmentChain',
      Mock__OVM_StateCommitmentChain
    )

    Mock__OVM_ExecutionManager.smocked.getMaxTransactionGasLimit.will.return.with(
      MAX_GAS_LIMIT
    )
  })

  let Factory__OVM_CanonicalTransactionChain: ContractFactory
  let Factory__OVM_ChainStorageContainer: ContractFactory
  before(async () => {
    Factory__OVM_CanonicalTransactionChain = await ethers.getContractFactory(
      'OVM_CanonicalTransactionChain'
    )

    Factory__OVM_ChainStorageContainer = await ethers.getContractFactory(
      'OVM_ChainStorageContainer'
    )
  })

  let OVM_CanonicalTransactionChain: Contract
  beforeEach(async () => {
    OVM_CanonicalTransactionChain = await Factory__OVM_CanonicalTransactionChain.deploy(
      AddressManager.address,
      FORCE_INCLUSION_PERIOD_SECONDS,
      FORCE_INCLUSION_PERIOD_BLOCKS,
      MAX_GAS_LIMIT
    )

    const batches = await Factory__OVM_ChainStorageContainer.deploy(
      AddressManager.address,
      'OVM_CanonicalTransactionChain'
    )
    const queue = await Factory__OVM_ChainStorageContainer.deploy(
      AddressManager.address,
      'OVM_CanonicalTransactionChain'
    )

    await AddressManager.setAddress(
      'OVM_ChainStorageContainer:CTC:batches',
      batches.address
    )

    await AddressManager.setAddress(
      'OVM_ChainStorageContainer:CTC:queue',
      queue.address
    )

    await AddressManager.setAddress(
      'OVM_CanonicalTransactionChain',
      OVM_CanonicalTransactionChain.address
    )
  })

  describe('appendSequencerBatch', () => {
    beforeEach(() => {
      OVM_CanonicalTransactionChain = OVM_CanonicalTransactionChain.connect(
        sequencer
      )
    })

    it('200 transactions in a single context', async () => {
      console.log(`Benchmark: 200 transactions in a single context.`)
      const timestamp = (await getEthTime(ethers.provider)) - 100
      const blockNumber = await getNextBlockNumber(ethers.provider)

      const transactionTemplate = '0x' + '11'.repeat(400)
      const transactions = []
      const numTxs = 200
      for (let i = 0; i < numTxs; i++) {
        transactions.push(transactionTemplate)
      }

      const fixedCalldataCost =
        (transactionTemplate.slice(2).length / 2) * 16 * numTxs

      const res = await appendSequencerBatch(OVM_CanonicalTransactionChain, {
        shouldStartAtElement: 0,
        totalElementsToAppend: numTxs,
        contexts: [
          {
            numSequencedTransactions: numTxs,
            numSubsequentQueueTransactions: 0,
            timestamp,
            blockNumber,
          },
        ],
        transactions,
      })

      const receipt = await res.wait()

      console.log('Benchmark complete.')
      console.log('Gas used:', receipt.gasUsed.toNumber())
      console.log('Fixed calldata cost:', fixedCalldataCost)
      console.log(
        'Non-calldata overhead gas cost per transaction:',
        (receipt.gasUsed.toNumber() - fixedCalldataCost) / numTxs
      )
    }).timeout(100000000)

    it('200 transactions in 200 contexts', async () => {
      console.log(`Benchmark: 200 transactions in 200 contexts.`)
      const timestamp = (await getEthTime(ethers.provider)) - 100
      const blockNumber = await getNextBlockNumber(ethers.provider)

      const transactionTemplate = '0x' + '11'.repeat(400)
      const transactions = []
      const numTxs = 200
      for (let i = 0; i < numTxs; i++) {
        transactions.push(transactionTemplate)
      }

      const fixedCalldataCost =
        (transactionTemplate.slice(2).length / 2) * 16 * numTxs

      const res = await appendSequencerBatch(OVM_CanonicalTransactionChain, {
        shouldStartAtElement: 0,
        totalElementsToAppend: numTxs,
        contexts: [...Array(numTxs)].map(() => {
          return {
            numSequencedTransactions: 1,
            numSubsequentQueueTransactions: 0,
            timestamp,
            blockNumber,
          }
        }),
        transactions,
      })

      const receipt = await res.wait()

      console.log('Benchmark complete.')
      console.log('Gas used:', receipt.gasUsed.toNumber())
      console.log('Fixed calldata cost:', fixedCalldataCost)
      console.log(
        'Non-calldata overhead gas cost per transaction:',
        (receipt.gasUsed.toNumber() - fixedCalldataCost) / numTxs
      )
    }).timeout(100000000)
  })
})
