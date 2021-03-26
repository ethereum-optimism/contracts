/* Imports: External */
import { task } from 'hardhat/config'
import { int } from 'hardhat/internal/core/params/argumentTypes'

const DEFAULT_CTC_FORCE_INCLUSION_PERIOD_SECONDS = 60 * 60 * 24 * 30 // 30 days
const DEFAULT_CTC_FORCE_INCLUSION_PERIOD_BLOCKS = (60 * 60 * 24 * 30) / 15 // 30 days in blocks
const DEFAULT_CTC_MAX_TRANSACTION_GAS_LIMIT = 9_000_000
const DEFAULT_EM_MIN_TRANSACTION_GAS_LIMIT = 50_000
const DEFAULT_EM_MAX_TRANSACTION_GAS_LIMIT = 9_000_000
const DEFAULT_EM_MAX_GAS_PER_QUEUE_PER_EPOCH = 250_000_000
const DEFAULT_EM_SECONDS_PER_EPOCH = 0
const DEFAULT_EM_OVM_CHAIN_ID = 420
const DEFAULT_SCC_FRAUD_PROOF_WINDOW = 60 * 60 * 24 * 7 // 7 days
const DEFAULT_SCC_SEQUENCER_PUBLISH_WINDOW = 60 * 30 // 30 minutes

task('deploy')
  .addOptionalParam(
    'ctcForceInclusionPeriodSeconds',
    'Number of seconds that the sequencer has to include transactions before the L1 queue.',
    DEFAULT_CTC_FORCE_INCLUSION_PERIOD_SECONDS,
    int
  )
  .addOptionalParam(
    'ctcForceInclusionPeriodBlocks',
    'Number of blocks that the sequencer has to include transactions before the L1 queue.',
    DEFAULT_CTC_FORCE_INCLUSION_PERIOD_BLOCKS,
    int
  )
  .addOptionalParam(
    'ctcMaxTransactionGasLimit',
    'Max gas limit for L1 queue transactions.',
    DEFAULT_CTC_MAX_TRANSACTION_GAS_LIMIT,
    int
  )
  .addOptionalParam(
    'emMinTransactionGasLimit',
    'Minimum allowed transaction gas limit.',
    DEFAULT_EM_MIN_TRANSACTION_GAS_LIMIT,
    int
  )
  .addOptionalParam(
    'emMaxTransactionGasLimit',
    'Maximum allowed transaction gas limit.',
    DEFAULT_EM_MAX_TRANSACTION_GAS_LIMIT,
    int
  )
  .addOptionalParam(
    'emMaxGasPerQueuePerEpoch',
    'Maximum gas allowed in a given queue for each epoch.',
    DEFAULT_EM_MAX_GAS_PER_QUEUE_PER_EPOCH,
    int
  )
  .addOptionalParam(
    'emSecondsPerEpoch',
    'Number of seconds in each epoch.',
    DEFAULT_EM_SECONDS_PER_EPOCH,
    int
  )
  .addOptionalParam(
    'emOvmChainId',
    'Chain ID for the L2 network.',
    DEFAULT_EM_OVM_CHAIN_ID,
    int
  )
  .addOptionalParam(
    'sccFraudProofWindow',
    'Number of seconds until a transaction is considered finalized.',
    DEFAULT_SCC_FRAUD_PROOF_WINDOW,
    int
  )
  .addOptionalParam(
    'sccSequencerPublishWindow',
    'Number of seconds that the sequencer is exclusively allowed to post state roots.',
    DEFAULT_SCC_SEQUENCER_PUBLISH_WINDOW,
    int
  )
  .setAction(async (args, hre: any, runSuper) => {
    hre.deployConfig = args
    return runSuper(args)
  })
