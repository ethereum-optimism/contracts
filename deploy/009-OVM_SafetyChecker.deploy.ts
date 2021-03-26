/* Imports: External */
import { DeployFunction } from 'hardhat-deploy/dist/types'

/* Imports: Internal */
import { deploy } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const cfg = {
    hre,
    name: 'OVM_SafetyChecker',
    args: [],
    withAddressManager: false,
  }
  await deploy(cfg)
}

deployFn.tags = ['OVM_SafetyChecker']

export default deployFn
