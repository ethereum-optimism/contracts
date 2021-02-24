import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('OVM_StateTransitionerFactory', {
    from: deployer,
    args: [
      Lib_AddressManager.address,
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
      'OVM_StateTransitionerFactory',
      contract.address,
    )
  }
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_StateTransitionerFactory']

export default deployFn
