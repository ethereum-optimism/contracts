import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('OVM_ExecutionManager', {
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

  if (contract.newlyDeployed) {
    await execute(
      'Lib_AddressManager',
      {
        from: deployer,
      },
      'setAddress',
      'OVM_ChainStorageContainer:ctc:batches',
      contract.address
    )
  }
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ExecutionManager']

export default deployFn
