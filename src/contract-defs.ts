import * as path from 'path'
import { ethers, ContractFactory, Signer } from 'ethers'
import { Interface } from 'ethers/lib/utils'
import { glob } from 'glob'
import { isLength } from 'lodash'

export const getContractDefinition = (name: string): any => {
  //console.log(glob.sync(path.join(__dirname, '../artifacts') + `/**/${name}.json`))
  const files = glob.sync(path.join(__dirname, '../artifacts') + `/**/${name}.json`)
  if (files.length == 0 ) {
    throw new Error (`Could not find artifact for ${name}`)
  }
  if (files.length > 1 ) {
    throw new Error(`Found more than 1 artifact for ${name}`)
  }
  return require(files[0])
}

export const getContractInterface = (name: string): Interface => {
  const definition = getContractDefinition(name)
  return new ethers.utils.Interface(definition.abi)
}

export const getContractFactory = (
  name: string,
  signer?: Signer
): ContractFactory => {
  const definition = getContractDefinition(name)
  const contractInterface = getContractInterface(name)
  return new ContractFactory(contractInterface, definition.bytecode, signer)
}
