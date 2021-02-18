import { DeployFunction } from "hardhat-deploy/dist/types";

const deployFn: DeployFunction = async (hre) => {
    const { deploy } = hre.deployments
    const { deployer } = await hre.getNamedAccounts()

    const Lib_AddressManager = await hre.deployments.get(
        'Lib_AddressManager'
    )

    await deploy('OVM_BondManager', {
        from: deployer,
        gasLimit: 4_000_000,
        args: [
            '0x0000000000000000000000000000000000000000',
            Lib_AddressManager.address,
        ],
    })
}

deployFn.dependencies = [
    'Lib_AddressManager'
]

export default deployFn
