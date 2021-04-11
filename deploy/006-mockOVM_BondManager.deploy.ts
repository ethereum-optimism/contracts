/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import {
  getDeployedContract,
  registerAddress,
} from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const { deploy } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await getDeployedContract(
    hre,
    'Lib_AddressManager',
    {
      signerOrProvider: deployer,
    }
  )

  const result = await deploy('mockOVM_BondManager', {
    from: deployer,
    args: [Lib_AddressManager.address],
    log: true,
  })

  if (!result.newlyDeployed) {
    return
  }

  await registerAddress({
    hre,
    name: 'OVM_BondManager',
    address: result.address,
  })
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['mockOVM_BondManager']

export default deployFn
