import { HardhatUserConfig } from 'hardhat/config'

import {
  DEFAULT_ACCOUNTS_BUIDLER,
  RUN_OVM_TEST_GAS,
} from './test/helpers/constants'

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-typechain'
import '@eth-optimism/smock/build/src/plugins/hardhat-storagelayout'

//import '@eth-optimism/smock/build/src/buidler-plugins/compiler-storage-layout' // TODO: upgrade to hardhat

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: DEFAULT_ACCOUNTS_BUIDLER, // TODO: rename w/o buidler
      blockGasLimit: RUN_OVM_TEST_GAS * 2,
    },
  },
  mocha: {
    timeout: 50000,
  },
  solidity: {
    version: '0.7.4',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    }
  },
  //typechain: {
  //  outDir: 'build/types',
  //  target: 'ethers-v5',
  //},
}

export default config
