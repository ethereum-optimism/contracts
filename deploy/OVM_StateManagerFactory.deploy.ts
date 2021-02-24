import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const contract = await deploy('OVM_StateManagerFactory', {
    from: deployer,
    args: [],
    log: true,
  })

  if (contract.newlyDeployed) {
    await execute(
      'Lib_AddressManager',
      {
        from: deployer
      },
      'setAddress',
      'OVM_StateManagerFactory',
      contract.address,
    )
  }
}

deployFn.tags = ['OVM_StateManagerFactory']

export default deployFn
