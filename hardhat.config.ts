import { HardhatUserConfig } from 'hardhat/types'

import {
  DEFAULT_ACCOUNTS_HARDHAT,
  RUN_OVM_TEST_GAS,
} from './test/helpers/constants'

// Hardhat plugins
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-typechain'
import 'hardhat-deploy'
import '@eth-optimism/plugins/hardhat/compiler'
import '@eth-optimism/smock/build/src/plugins/hardhat-storagelayout'

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: DEFAULT_ACCOUNTS_HARDHAT,
      blockGasLimit: RUN_OVM_TEST_GAS * 2,
      live: false,
      saveDeployments: false,
      tags: ['test', 'local'],
    },
    kovan: {
      url: 'https://kovan.infura.io/v3/',
      accounts: [''],
      live: true,
      saveDeployments: true,
      tags: ['test', 'kovan'],
    },
  },
  mocha: {
    timeout: 50000,
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: { enabled: true, runs: 200 },
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
