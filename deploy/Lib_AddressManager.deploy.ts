import { DeployFunction } from "hardhat-deploy/dist/types";

const deployFn: DeployFunction = async (hre) => {
    const { deploy } = hre.deployments
    const { deployer } = await hre.getNamedAccounts()

    await deploy('Lib_AddressManager', {
        from: deployer,
        gasLimit: 4_000_000,
        args: [],
    })
}

deployFn.tags = [
    'Lib_AddressManager'
]

export default deployFn
