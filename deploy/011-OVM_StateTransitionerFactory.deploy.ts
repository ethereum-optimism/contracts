/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { deploy } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const cfg = {
    hre,
    name: 'OVM_StateTransitionerFactory',
    args: [],
  }
  await deploy(cfg)
}

deployFn.dependencies = ['Lib_AddressManager']
deployFn.tags = ['OVM_StateTransitionerFactory']

export default deployFn
