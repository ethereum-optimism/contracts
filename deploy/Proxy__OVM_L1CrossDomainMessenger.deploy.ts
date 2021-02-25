import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('Lib_ResolvedDelegateProxy', {
    from: deployer,
    args: [Lib_AddressManager.address, 'OVM_L1CrossDomainMessenger'],
    log: true,
  })

  if (contract.newlyDeployed) {
    await execute(
      'Lib_AddressManager',
      {
        from: deployer,
      },
      'setAddress',
      'Proxy__OVM_L1CrossDomainMessenger',
      contract.address
    )
  }
}

deployFn.tags = ['Proxy__OVM_L1CrossDomainMessenger']

export default deployFn
