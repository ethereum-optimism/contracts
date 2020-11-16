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
import './plugins/hardhat-ovm-compiler'
//import '@eth-optimism/smock/build/src/plugins/hardhat-storagelayout'

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
  .addFlag('ovm','Compile with the OVM Solidity compiler')
  .setAction(async (taskArguments, hre, runSuper) => {
    if (taskArguments.ovm) {
			hre.config.solidity = {
        compilers: [
          {
            settings: {},
            version: '0.6.0',
          }
        ]
      } as any
      ;(hre.config as any).ovm = true
      ;(hre.config as any).solc = path.resolve(__dirname, 'node_modules', '@eth-optimism', 'solc', 'soljson.js')
      hre.config.paths.artifacts = 'ovm-artifacts'
      hre.config.paths.cache = 'ovm-cache'
		}
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
    artifacts: 'evm-artifacts',
    cache: 'evm-cache',
  },
} as any

export default config
