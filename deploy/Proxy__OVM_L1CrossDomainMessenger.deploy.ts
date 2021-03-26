import { ethers } from 'ethers'
import { DeployFunction } from 'hardhat-deploy/dist/types'

const deployFn: DeployFunction = async (hre) => {
  const { deploy, execute, rawTx } = hre.deployments
  const { deployer } = await hre.getNamedAccounts()

  const Lib_AddressManager = await hre.deployments.get('Lib_AddressManager')

  const contract = await deploy('Proxy__OVM_L1CrossDomainMessenger', {
    contract: 'Lib_ResolvedDelegateProxy',
    from: deployer,
    args: [Lib_AddressManager.address, 'OVM_L1CrossDomainMessenger'],
    log: true,
  })

  if (contract.newlyDeployed) {
    await rawTx({
      to: contract.address,
      from: deployer,
      data:
        ethers.utils.id('initialize(address)').slice(0, 10) +
        Lib_AddressManager.address.slice(2).padStart(64, '0'),
    })

    await execute(
      'Lib_AddressManager',
      {
        from: deployer,
      },
      'setAddress',
      'Proxy__OVM_L1CrossDomainMessenger',
      contract.address
    )
  }
}

deployFn.dependencies = ['OVM_L1CrossDomainMessenger']
deployFn.tags = ['Proxy__OVM_L1CrossDomainMessenger']

export default deployFn
