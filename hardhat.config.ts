import { HardhatUserConfig } from 'hardhat/types'
import 'solidity-coverage'
import * as dotenv from 'dotenv'

import {
  DEFAULT_ACCOUNTS_HARDHAT,
  RUN_OVM_TEST_GAS,
} from './test/helpers/constants'

// Hardhat plugins
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-deploy'
import '@typechain/hardhat'
import '@eth-optimism/plugins/hardhat/compiler'
import './hh'

// Load environment variables from .env
dotenv.config()

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: DEFAULT_ACCOUNTS_HARDHAT,
      blockGasLimit: RUN_OVM_TEST_GAS * 2,
      live: false,
      saveDeployments: false,
      tags: ['local'],
    },
  },
  mocha: {
    timeout: 50000,
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    },
  },
  typechain: {
    outDir: 'build/types',
    target: 'ethers-v5',
  },
  paths: {
    deploy: './deploy',
    deployments: './deployments',
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
}

if (
  process.env.CONTRACTS_GOERLI_DEPLOYER_KEY &&
  process.env.CONTRACTS_GOERLI_RPC_URL
) {
  config.networks.goerli = {
    accounts: [process.env.CONTRACTS_GOERLI_DEPLOYER_KEY],
    url: process.env.CONTRACTS_GOERLI_RPC_URL,
    live: true,
    saveDeployments: true,
    tags: ['goerli'],
  }
}

if (
  process.env.CONTRACTS_KOVAN_DEPLOYER_KEY &&
  process.env.CONTRACTS_KOVAN_RPC_URL
) {
  config.networks.kovan = {
    accounts: [process.env.CONTRACTS_KOVAN_DEPLOYER_KEY],
    url: process.env.CONTRACTS_KOVAN_RPC_URL,
    live: true,
    saveDeployments: true,
    tags: ['kovan'],
  }
}

if (
  process.env.CONTRACTS_MAINNET_DEPLOYER_KEY &&
  process.env.CONTRACTS_MAINNET_RPC_URL
) {
  config.networks.mainnet = {
    accounts: [process.env.CONTRACTS_MAINNET_DEPLOYER_KEY],
    url: process.env.CONTRACTS_MAINNET_RPC_URL,
    live: true,
    saveDeployments: true,
    tags: ['mainnet'],
  }
}

if (
  process.env.CONTRACTS_CUSTOM_NETWORK_DEPLOYER_KEY &&
  process.env.CONTRACTS_CUSTOM_NETWORK_RPC_URL
) {
  config.networks.custom = {
    accounts: [process.env.CONTRACTS_CUSTOM_NETWORK_DEPLOYER_KEY],
    url: process.env.CONTRACTS_CUSTOM_NETWORK_RPC_URL,
    live: true,
    saveDeployments: true,
    tags: ['custom'],
  }
}

export default config
