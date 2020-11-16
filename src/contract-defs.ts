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
  const files = glob.sync(
    path.join(__dirname, '../artifacts') + `/**/${name}.json`
  )

  if (files.length == 0) {
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
  const definition = getContractDefinition(name)
  return new ethers.utils.Interface(definition.abi)
}

export const getContractFactory = (
  name: string,
  options: {
    signer?: Signer
    ovm?: boolean
  } = {}
): ContractFactory => {
  const definition = getContractDefinition(name)
  const contractInterface = getContractInterface(name)
  return new ContractFactory(contractInterface, definition.bytecode, options.signer)
}
