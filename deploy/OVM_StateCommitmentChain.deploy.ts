import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('OVM_StateCommitmentChain', {
    from: deployer,
    args: [
      Lib_AddressManager.address,
      60000, // _fraudProofWindow
      60000, // _sequencerPublishWindow
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
      'OVM_StateCommitmentChain',
      contract.address
    )
  }
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_StateCommitmentChain']

export default deployFn
