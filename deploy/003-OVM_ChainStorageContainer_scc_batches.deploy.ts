/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { deploy } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const cfg = {
    hre,
    name: 'OVM_ChainStorageContainer:SCC:queue',
    contract: 'OVM_ChainStorageContainer',
    args: ['OVM_StateCommitmentChain'],
  }
  await deploy(cfg)
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ChainStorageContainer_scc_queue']

export default deployFn
