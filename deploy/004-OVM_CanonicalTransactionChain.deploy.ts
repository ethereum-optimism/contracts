/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { deploy } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const cfg = {
    hre,
    name: 'OVM_CanonicalTransactionChain',
    args: [
      (hre as any).deployConfig.ctcForceInclusionPeriodSeconds,
      (hre as any).deployConfig.ctcForceInclusionPeriodBlocks,
      (hre as any).deployConfig.ctcMaxTransactionGasLimit,
    ],
  }
  await deploy(cfg)
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_CanonicalTransactionChain']

export default deployFn
