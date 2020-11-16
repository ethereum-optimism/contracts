import { HardhatUserConfig, task, subtask } from 'hardhat/config'
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from 'hardhat/builtin-tasks/task-names'
import { glob } from 'glob'
import * as fs from 'fs'
import * as path from 'path'

import {
  DEFAULT_ACCOUNTS_BUIDLER,
  RUN_OVM_TEST_GAS,
} from './test/helpers/constants'

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
//import '@eth-optimism/smock/build/src/plugins/hardhat-storagelayout'
import './plugins/hardhat-ovm-compiler'

subtask(
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  async (_, { config }, runSuper): Promise<string[]> => {
    const paths = glob.sync(path.join(config.paths.sources, '**/*.sol'))

    if ((config as any).ovm) {
      return paths.filter((file) => {
        const content = fs.readFileSync(file).toString()
        return content.includes('// +build ovm' || '// +build evm ovm')
      })
    } else {
      return paths.filter((file) => {
        const content = fs.readFileSync(file).toString()
        return content.includes('// +build evm' || '// +build ovm evm')
      })
    }
  }
)

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
}

if (process.env.COMPILE_OVM === 'true') {
  // OVM configuration.

  config.solidity = {
    compilers: [
      {
        settings: {},
        version: '0.6.0',
      },
    ],
    overrides: {},
  }
  ;(config as any).ovm = true
  ;(config as any).solc = path.resolve(
    __dirname,
    'node_modules',
    '@eth-optimism',
    'solc',
    'soljson.js'
  )

  config.paths = {
    artifacts: 'ovm-artifacts',
    cache: 'ovm-cache',
  }
} else {
  // EVM configuration.

  config.solidity = {
    compilers: [
      {
        version: '0.7.4',
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
    overrides: {},
  }

  config.paths = {
    artifacts: 'evm-artifacts',
    cache: 'evm-cache',
  }
}

export default config
