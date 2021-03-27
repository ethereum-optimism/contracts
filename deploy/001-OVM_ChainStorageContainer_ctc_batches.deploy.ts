/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { deploy } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const cfg = {
    hre,
    name: 'OVM_ChainStorageContainer:CTC:batches',
    contract: 'OVM_ChainStorageContainer',
    args: ['OVM_CanonicalTransactionChain'],
  }
  await deploy(cfg)
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_ChainStorageContainer_ctc_batches']

export default deployFn
