import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('OVM_ChainStorageContainer:CTC:batches', {
    contract: 'OVM_ChainStorageContainer',
    from: deployer,
    args: [
      Lib_AddressManager.address,
      'OVM_CanonicalTransactionChain',
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
      'OVM_ChainStorageContainer:CTC:batches',
      contract.address,
    )
  }
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ChainStorageContainer_ctc_batches']

export default deployFn
