import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('OVM_ChainStorageContainer:SCC:batches', {
    contract: 'OVM_ChainStorageContainer',
    from: deployer,
    args: [
      Lib_AddressManager.address,
      'OVM_StateCommitmentChain'
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
      'OVM_ChainStorageContainer:SCC:queue',
      contract.address,
    )
  }
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ChainStorageContainer_scc_batches']

export default deployFn
