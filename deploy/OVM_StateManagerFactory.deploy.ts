import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  await deploy('OVM_StateManagerFactory', {
    from: deployer,
    gasLimit: 4_000_000,
    args: [],
  })
}

export default deployFn
