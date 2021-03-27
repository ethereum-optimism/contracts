/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { deploy } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const cfg = {
    hre,
    name: 'OVM_ExecutionManager',
    args: [
      {
        minTransactionGasLimit: (hre as any).deployConfig
          .emMinTransactionGasLimit,
        maxTransactionGasLimit: (hre as any).deployConfig
          .emMaxGasPerQueuePerEpoch,
        maxGasPerQueuePerEpoch: (hre as any).deployConfig
          .emMaxGasPerQueuePerEpoch,
        secondsPerEpoch: (hre as any).deployConfig.emSecondsPerEpoch,
      },
      {
        ovmCHAINID: (hre as any).deployConfig.emOvmChainId,
      },
    ],
  }
  await deploy(cfg)
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ExecutionManager']

export default deployFn
