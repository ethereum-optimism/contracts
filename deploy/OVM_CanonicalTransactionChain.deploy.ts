import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  await deploy('OVM_CanonicalTransactionChain', {
    from: deployer,
    gasLimit: 4_000_000,
    args: [
      Lib_AddressManager.address,
      600, // _forceInclusionPeriodSeconds
      10, // _forceInclusionPeriodBlocks
      9_000_000, // _maxTransactionGasLimit
    ],
  })
}

deployFn.dependencies = ['Lib_AddressManager']

export default deployFn
