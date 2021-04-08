#!/usr/bin/env node

const path = require('path')
const { spawn } = require('child_process')
const dirtree = require('directory-tree')

const main = async () => {
  const task = spawn(path.join(__dirname, 'deploy.ts'))

  await new Promise((resolve) => {
    task.on('exit', () => {
      resolve()
    })
  })

  const nicknames = {
    'Lib_AddressManager': 'AddressManager',
    'mockOVM_BondManager': 'OVM_BondManager'
  }

  const contracts = dirtree(
    path.resolve(__dirname, `../deployments/custom`)
  ).children.filter((child) => {
    return child.extension === '.json'
  }).reduce((contracts, child) => {
    const contractName = child.name.replace('.json', '')
    const artifact = require(path.resolve(__dirname, `../deployments/custom/${child.name}`))
    contracts[nicknames[contractName] || contractName] = artifact.address
    return contracts
  }, {})

  console.log(JSON.stringify(contracts, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(
      JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    )
    process.exit(1)
  })
