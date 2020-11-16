import * as fs from 'fs'
import { subtask } from 'hardhat/config'
import {
  TASK_COMPILE_SOLIDITY_RUN_SOLCJS,
  TASK_COMPILE_SOLIDITY_RUN_SOLC,
} from 'hardhat/builtin-tasks/task-names'

subtask(
  TASK_COMPILE_SOLIDITY_RUN_SOLCJS,
  async (
    { input, solcJsPath }: { input: any, solcJsPath: string },
    { config },
    runSuper
  ) => {
    if (fs.existsSync((config as any).solc)) {
      solcJsPath = (config as any).solc
    }

    return runSuper({ input, solcJsPath })
  }
)

subtask(
  TASK_COMPILE_SOLIDITY_RUN_SOLC,
  async (
    { input, solcPath }: { input: any, solcPath: string },
    { config, run },
    runSuper
  ) => {
    if (fs.existsSync((config as any).solc)) {
      return run(TASK_COMPILE_SOLIDITY_RUN_SOLCJS, {
        input,
        solcJsPath: (config as any).solc
      })
    } else {
      const ret = await runSuper({ input, solcPath })

      console.log(ret)

      return ret
    }
  }
)