#!/usr/bin/env node

const path = require('path')
const { spawn } = require('child_process')

const main = async () => {
  const task = spawn(path.join(__dirname, 'deploy.ts'), { stdio: 'inherit' })

  await new Promise((resolve) => {
    task.on('exit', () => {
      resolve()
    })
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(
      JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    )
    process.exit(1)
  })
