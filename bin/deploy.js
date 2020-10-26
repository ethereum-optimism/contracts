#!/usr/bin/env -S node --require ts-node/register

const contracts = require('../src/index.ts');
const { providers, Wallet } = require('ethers')
const { JsonRpcProvider } = providers;

const key = process.env.DEPLOYER_PRIVATE_KEY;
const sequencerKey = process.env.SEQUENCER_PRIVATE_KEY;
const web3Url = process.env.L1_NODE_WEB3_URL || 'http://127.0.0.1:8545';
const MIN_TRANSACTION_GAS_LIMIT = process.env.MIN_TRANSACTION_GAS_LIMIT || 0;
const MAX_TRANSACTION_GAS_LIMIT = process.env.MAX_TRANSACTION_GAS_LIMIT || 1000000000;
const MAX_GAS_PER_QUEUE_PER_EPOCH = process.env.MAX_GAS_PER_QUEUE_PER_EPOCH || 1000000000000;
const SECONDS_PER_EPOCH = process.env.SECONDS_PER_EPOCH = 600;
let WHITELIST_OWNER = process.env.WHITELIST_OWNER;
const WHITELIST_ALLOW_ARBITRARY_CONTRACT_DEPLOYMENT = process.env.WHITELIST_ALLOW_ARBITRARY_CONTRACT_DEPLOYMENT || false;
const FORCE_INCLUSION_PERIOD_SECONDS = process.env.FORCE_INCLUSION_PERIOD_SECONDS || 1 << 28;

(async () => {
  if (typeof key === 'undefined')
    throw new Error('Must pass deployer key as DEPLOYER_PRIVATE_KEY')

  if (typeof sequencerKey === 'undefined')
    throw new Error('Must pass sequencer key as SEQUENCER_PRIVATE_KEY')

  const provider = new JsonRpcProvider(web3Url);
  const signer = new Wallet(key, provider);
  const sequencer = new Wallet(sequencerKey, provider);

  const chainid = await provider.send('eth_chainId', []);

  if (typeof WHITELIST_OWNER === 'undefined')
    WHITELIST_OWNER = signer;

  const result = await contracts.deploy({
    deploymentSigner: signer,
    transactionChainConfig: {
      forceInclusionPeriodSeconds: FORCE_INCLUSION_PERIOD_SECONDS,
      sequencer: sequencer
    },
    ovmGlobalContext: {
      ovmCHAINID: chainid
    },
    ovmGasMeteringConfig: {
      minTransactionGasLimit: MIN_TRANSACTION_GAS_LIMIT,
      maxTransactionGasLimit: MAX_TRANSACTION_GAS_LIMIT,
      maxGasPerQueuePerEpoch: MAX_GAS_PER_QUEUE_PER_EPOCH,
      secondsPerEpoch: SECONDS_PER_EPOCH
    },
    whitelistConfig: {
      owner: WHITELIST_OWNER,
      allowArbitraryContractDeployment: WHITELIST_ALLOW_ARBITRARY_CONTRACT_DEPLOYMENT
    },
  });

  const { failedDeployments, AddressManager } = result;
  if (failedDeployments.length != 0)
    throw new Error(`Contract deployment failed: ${failedDeployments.join(',')}`);

  const out = {};
  for (const [name, contract] of Object.entries(result.contracts)) {
    out[name] = contract.address;
  }
  console.log(JSON.stringify(out, null, 2));
})().catch(err => {
  console.log(err)

  console.log(JSON.stringify({error: err}));
  process.exit(1);
});
