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

  const contracts = dirtree(
    path.resolve(__dirname, `../deployments/custom`)
  ).children.filter((child) => {
    return child.extension === '.json'
  }).reduce((contracts, child) => {
    const artifact = require(path.resolve(__dirname, `../deployments/custom/${child.name}`))
    contracts[child.name.replace('.json', '')] = artifact.address
    return contracts
  }, {})

  console.log(contracts)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(
      JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    )
    process.exit(1)
  })
