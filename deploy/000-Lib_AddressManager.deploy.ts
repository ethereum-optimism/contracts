import { DeployFunction } from 'hardhat-deploy/dist/types'
import { registerAddress } from '../src/hardhat-deploy-ethers'

const deployFn: DeployFunction = async (hre) => {
  const { deploy } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  await deploy('Lib_AddressManager', {
    from: deployer,
    args: [],
    log: true,
  })

  await registerAddress({
    hre,
    name: 'OVM_L2CrossDomainMessenger',
    address: '0x4200000000000000000000000000000000000007',
  })

  await registerAddress({
    hre,
    name: 'OVM_DecompressionPrecompileAddress',
    address: '0x4200000000000000000000000000000000000005',
  })

  await registerAddress({
    hre,
    name: 'OVM_Sequencer',
    address: (hre as any).deployConfig.ovmSequencerAddress,
  })
}

deployFn.tags = ['Lib_AddressManager', 'required']

export default deployFn
