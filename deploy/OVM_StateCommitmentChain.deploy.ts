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

  const result = await deploy('OVM_StateCommitmentChain', {
    from: deployer,
    args: [
      Lib_AddressManager.address,
      (hre as any).deployConfig.sccFraudProofWindow,
      (hre as any).deployConfig.sccSequencerPublishWindow,
    ],
    log: true,
  })

  if (!result.newlyDeployed) {
    return
  }

  await Lib_AddressManager.setAddress(
    'OVM_StateCommitmentChain',
    result.address
  )
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_StateCommitmentChain']

export default deployFn
