import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  await deploy('OVM_ExecutionManager', {
    from: deployer,
    gasLimit: 4_000_000,
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
  })
}

deployFn.dependencies = ['Lib_AddressManager']

export default deployFn
