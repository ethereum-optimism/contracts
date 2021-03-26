import { HardhatUserConfig } from 'hardhat/types'

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

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: DEFAULT_ACCOUNTS_HARDHAT,
      blockGasLimit: RUN_OVM_TEST_GAS * 2,
      live: false,
      saveDeployments: false,
      tags: ['test', 'local'],
    },
    goerli: {
      accounts: [
        '',
      ],
      url: '',
      live: true,
      saveDeployments: true,
      tags: ['test', 'goerli'],
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

export default config
