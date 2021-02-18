import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  await deploy('OVM_StateCommitmentChain', {
    from: deployer,
    gasLimit: 4_000_000,
    args: [
      Lib_AddressManager.address,
      60000, // _fraudProofWindow
      60000, // _sequencerPublishWindow
    ],
  })
}

deployFn.dependencies = ['Lib_AddressManager']

export default deployFn
