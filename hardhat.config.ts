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
import '@eth-optimism/smock/build/src/plugins/hardhat-storagelayout'

subtask(
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  async (_, { config }, runSuper): Promise<string[]> => {
    const paths = glob.sync(path.join(config.paths.sources, "**/*.sol"))

    if ((config as any).ovm) {
      return paths.filter((file) => {
        const content = fs.readFileSync(file).toString()
        return content.includes('// +build ovm')
      })
    } else {
      return paths.filter((file) => {
        const content = fs.readFileSync(file).toString()
        return content.includes('// +build evm')
      })
    }
  }
);

task('compile')
  .setAction(async (taskArguments, hre, runSuper) => {
    // Run the task.
    await runSuper(taskArguments)
  })

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
    },
  },
  paths: {
    artifacts: 'ovm-artifacts',
    cache: 'ovm-cache',
  },
  ovm: true,
} as any

export default config
