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
  paths: {
    deploy: './deploy',
    deployments: './deployments',
  },
  networks: {
    hardhat: {
      accounts: DEFAULT_ACCOUNTS_HARDHAT,
      blockGasLimit: RUN_OVM_TEST_GAS * 2,
      live: true,
      saveDeployments: true,
      tags: ['test', 'local'],
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
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
}

export default config
