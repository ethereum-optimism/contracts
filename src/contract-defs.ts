import * as path from 'path'
import { ethers, ContractFactory, Signer } from 'ethers'
import { Interface } from 'ethers/lib/utils'
import { glob } from 'glob'

export const getContractDefinition = (
  name: string,
  options: {
    ovm?: boolean
  } = {}
): any => {
  var files
  if (options.ovm) {
    files = glob.sync(
      path.join(__dirname, '../ovm-artifacts') + `/**/${name}.json`
    )
  } else {
    files = glob.sync(
      path.join(__dirname, '../evm-artifacts') + `/**/${name}.json`
    )
  }

  if (files.length === 0) {
    throw new Error(`Could not find artifact for ${name}`)
  }

  if (files.length > 1) {
    throw new Error(`Found more than 1 artifact for ${name}`)
  }

  return require(files[0])
}

export const getContractInterface = (
  name: string,
  options: {
    ovm?: boolean
  } = {}
): Interface => {
  const definition = getContractDefinition(name, options)
  return new ethers.utils.Interface(definition.abi)
}

export const getContractFactory = (
  name: string,
  options: {
    signer?: Signer
    ovm?: boolean
  } = {}
): ContractFactory => {
  const definition = getContractDefinition(name, options)
  const contractInterface = getContractInterface(name, options)
  return new ContractFactory(
    contractInterface,
    definition.bytecode,
    options.signer
  )
}
