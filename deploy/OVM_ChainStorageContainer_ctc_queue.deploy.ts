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

  const result = await deploy('OVM_ChainStorageContainer:CTC:queue', {
    contract: 'OVM_ChainStorageContainer',
    from: deployer,
    args: [Lib_AddressManager.address, 'OVM_CanonicalTransactionChain'],
    log: true,
  })

  if (!result.newlyDeployed) {
    return
  }

  await Lib_AddressManager.setAddress(
    'OVM_ChainStorageContainer:CTC:queue',
    result.address
  )
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ChainStorageContainer_ctc_queue']

export default deployFn
