/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { getDeployedContract } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const { deploy } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await getDeployedContract(
    hre,
    'Lib_AddressManager',
    {
      signerOrProvider: deployer,
    }
  )

  const result = await deploy('OVM_ExecutionManager', {
    from: deployer,
    args: [
      Lib_AddressManager.address,
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
    log: true,
  })

  if (!result.newlyDeployed) {
    return
  }

  await Lib_AddressManager.setAddress('OVM_ExecutionManager', result.address)
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ExecutionManager']

export default deployFn
