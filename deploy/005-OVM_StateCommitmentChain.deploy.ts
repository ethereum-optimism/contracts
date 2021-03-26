/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { deploy } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const cfg = {
    hre,
    name: 'OVM_StateCommitmentChain',
    args: [
      (hre as any).deployConfig.sccFraudProofWindow,
      (hre as any).deployConfig.sccSequencerPublishWindow,
    ],
  }
  await deploy(cfg)
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_StateCommitmentChain']

export default deployFn
