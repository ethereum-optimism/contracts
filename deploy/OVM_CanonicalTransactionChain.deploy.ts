import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('OVM_CanonicalTransactionChain', {
    from: deployer,
    args: [
      Lib_AddressManager.address,
      (hre as any).deployConfig.ctcForceInclusionPeriodSeconds,
      (hre as any).deployConfig.ctcForceInclusionPeriodBlocks,
      (hre as any).deployConfig.ctcMaxTransactionGasLimit,
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
      'OVM_CanonicalTransactionChain',
      contract.address
    )
  }
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_CanonicalTransactionChain']

export default deployFn
