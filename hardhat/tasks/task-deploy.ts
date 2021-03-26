import { task } from 'hardhat/config'
import { int } from 'hardhat/internal/core/params/argumentTypes'

task('deploy')
  .addOptionalParam(
    'ctcForceInclusionPeriodSeconds',
    '',
    60 * 60 * 24 * 30,
    int
  )
  .addOptionalParam(
    'ctcForceInclusionPeriodBlocks',
    '',
    (60 * 60 * 24 * 30) / 15,
    int
  )
  .addOptionalParam('ctcMaxTransactionGasLimit', '', 9_000_000, int)
  .addOptionalParam('emMinTransactionGasLimit', '', 50_000, int)
  .addOptionalParam('emMaxTransactionGasLimit', '', 9_000_000, int)
  .addOptionalParam('emMaxGasPerQueuePerEpoch', '', 250_000_000, int)
  .addOptionalParam('emSecondsPerEpoch', '', 0, int)
  .addOptionalParam('emOvmChainId', '', 420, int)
  .addOptionalParam('sccFraudProofWindow', '', 60 * 60 * 24 * 7, int)
  .addOptionalParam('sccSequencerPublishWindow', '', 60 * 30, int)
  .setAction(async (args, hre: any, runSuper) => {
    hre.deployConfig = args
    return runSuper(args)
  })
