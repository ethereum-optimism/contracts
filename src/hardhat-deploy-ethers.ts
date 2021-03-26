/* Imports: External */
import { Contract } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

export const getDeployedContract = async (
  hre: HardhatRuntimeEnvironment,
  name: string,
  options: {
    iface?: string
    signerOrProvider?: Signer | Provider | string
  } = {}
): Promise<Contract> => {
  const deployed = await hre.deployments.get(name)

  await hre.ethers.provider.waitForTransaction(deployed.receipt.transactionHash)

  // Get the correct interface.
  let iface = new hre.ethers.utils.Interface(deployed.abi)
  if (options.iface) {
    const factory = await hre.ethers.getContractFactory(options.iface)
    iface = factory.interface
  }

  let signerOrProvider: Signer | Provider = hre.ethers.provider
  if (options.signerOrProvider) {
    if (typeof options.signerOrProvider === 'string') {
      signerOrProvider = hre.ethers.provider.getSigner(options.signerOrProvider)
    } else {
      signerOrProvider = options.signerOrProvider
    }
  }

  const def = Object.defineProperty
  Object.defineProperty = (obj, name, prop) => {
    prop.writable = true
    return def(obj, name, prop)
  }
  const contract = new Contract(deployed.address, iface, signerOrProvider)
  Object.defineProperty = def

  for (const name of Object.keys(contract.functions)) {
    const fn = contract[name].bind(contract)
    ;(contract as any)[name] = async (...args: any) => {
      const result = await fn(...args)
      if (typeof result === 'object' && typeof result.wait === 'function') {
        await result.wait()
      }
      return result
    }
  }

  return contract
}
