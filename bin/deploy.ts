#!/usr/bin/env ts-node-script

import { Wallet } from 'ethers'

process.env.HARDHAT_NETWORK = 'custom'
process.env.CONTRACTS_TARGET_NETWORK = 'custom'
process.env.CONTRACTS_DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY
process.env.CONTRACTS_RPC_URL =
  process.env.L1_NODE_WEB3_URL || 'http://127.0.0.1:8545'

import hre from 'hardhat'

const main = async () => {
  const sequencer = new Wallet(process.env.SEQUENCER_PRIVATE_KEY)

  await hre.run('deploy', {
    l1BlockTimeSeconds: process.env.BLOCK_TIME_SECONDS,
    ctcForceInclusionPeriodSeconds: process.env.FORCE_INCLUSION_PERIOD_SECONDS,
    ctcMaxTransactionGasLimit: process.env.MAX_TRANSACTION_GAS_LIMIT,
    emMinTransactionGasLimit: process.env.MIN_TRANSACTION_GAS_LIMIT,
    emMaxtransactionGasLimit: process.env.MAX_TRANSACTION_GAS_LIMIT,
    emMaxGasPerQueuePerEpoch: process.env.MAX_GAS_PER_QUEUE_PER_EPOCH,
    emSecondsPerEpoch: process.env.SECONDS_PER_EPOCH,
    emOvmChainId: process.env.CHAIN_ID,
    sccFraudProofWindow: parseInt(process.env.FRAUD_PROOF_WINDOW_SECONDS, 10),
    sccSequencerPublishWindow: process.env.SEQUENCER_PUBLISH_WINDOW_SECONDS,
    ovmSequencerAddress: sequencer.address,
    ovmRelayerAddress: sequencer.address,
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(
      JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    )
    process.exit(1)
  })
