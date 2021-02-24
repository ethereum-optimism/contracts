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
        minTransactionGasLimit: 20_000,
        maxTransactionGasLimit: 9_000_000,
        maxGasPerQueuePerEpoch: 9_000_000,
        secondsPerEpoch: 0,
      },
      {
        ovmCHAINID: 10,
      },
    ],
    log: true,
  })

  if (contract.newlyDeployed) {
    await execute(
      'Lib_AddressManager',
      {
        from: deployer
      },
      'setAddress',
      'OVM_ChainStorageContainer:ctc:batches',
      contract.address,
    )
  }
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ExecutionManager']

export default deployFn
