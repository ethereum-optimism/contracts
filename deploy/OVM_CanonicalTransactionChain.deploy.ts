/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { getDeployedContract } from '../src/hardhat-deploy-ethers'

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

  const result = await deploy('OVM_CanonicalTransactionChain', {
    from: deployer,
    args: [
      Lib_AddressManager.address,
      (hre as any).deployConfig.ctcForceInclusionPeriodSeconds,
      (hre as any).deployConfig.ctcForceInclusionPeriodBlocks,
      (hre as any).deployConfig.ctcMaxTransactionGasLimit,
    ],
    log: true,
  })

  if (!result.newlyDeployed) {
    return
  }

  await Lib_AddressManager.setAddress(
    'OVM_CanonicalTransactionChain',
    result.address
  )
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_CanonicalTransactionChain']

export default deployFn
