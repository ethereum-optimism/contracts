/* External Imports */
import { Signer, Contract, ContractFactory } from 'ethers'
import { TransactionReceipt } from '@ethersproject/abstract-provider'

/* Internal Imports */
import { RollupDeployConfig, makeContractDeployConfig } from './config'
import { getContractFactory } from '../contract-defs'

export interface DeployResult {
  AddressManager: Contract
  failedDeployments: string[]
  contracts: {
    [name: string]: { contract: Contract; receipt: TransactionReceipt }
  }
}

export const deploy = async (
  config: RollupDeployConfig
): Promise<DeployResult> => {
  const AddressManager: Contract = await getContractFactory(
    'Lib_AddressManager',
    config.deploymentSigner
  ).deploy()

  const contractDeployConfig = await makeContractDeployConfig(
    config,
    AddressManager
  )

  const failedDeployments: string[] = []
  const contracts: {
    [name: string]: { contract: Contract; receipt: TransactionReceipt }
  } = {}

  for (const [name, contractDeployParameters] of Object.entries(
    contractDeployConfig
  )) {
    if (config.dependencies && !config.dependencies.includes(name)) {
      continue
    }

    try {
      contracts[name] = {} as any
      contracts[name].contract = await contractDeployParameters.factory
        .connect(config.deploymentSigner)
        .deploy(...(contractDeployParameters.params || []))
      await AddressManager.setAddress(name, contracts[name].contract.address)
    } catch (err) {
      failedDeployments.push(name)
    }
  }

  const names = []
  let receipts = []
  for (const [name, deployParams] of Object.entries(contracts)) {
    names.push(name)
    receipts.push(deployParams.contract.deployTransaction.wait())
  }

  receipts = await Promise.all(receipts)
  for (let i = 0; i < receipts.length; i++) {
    contracts[names[i]].receipt = receipts[i]
  }

  for (const [name, contractDeployParameters] of Object.entries(
    contractDeployConfig
  )) {
    if (config.dependencies && !config.dependencies.includes(name)) {
      continue
    }

    if (contractDeployParameters.afterDeploy) {
      await contractDeployParameters.afterDeploy(contracts)
    }
  }

  return {
    AddressManager,
    failedDeployments,
    contracts,
  }
}
