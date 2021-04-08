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

const registerNetwork = (network: string) => {
  const rpcUrl = process.env[`CONTRACTS_${network.toUpperCase()}_RPC_URL`]
  const deployKey =
    process.env[`CONTRACTS_${network.toUpperCase()}_DEPLOYER_KEY`]
  if (deployKey && rpcUrl) {
    config.networks[network] = {
      accounts: [deployKey],
      url: rpcUrl,
      live: true,
      saveDeployments: true,
      tags: [network],
    }
  }
}

registerNetwork('kovan')
registerNetwork('goerli')
registerNetwork('mainnet')
registerNetwork('custom')

export default config
