#!/usr/bin/env node

/**
 * Simple startup script for development
 */
const { spawn } = require('child_process')
const path = require('path')

// Start renderer dev server
const vite = spawn('npm', ['run', 'dev:renderer'], {
  stdio: 'inherit',
  shell: true
})

// Wait a bit for Vite to start, then compile and run Electron
setTimeout(() => {
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], {
    stdio: 'inherit',
    shell: true
  })

  tsc.on('exit', (code) => {
    if (code === 0) {
      // Remove ELECTRON_RUN_AS_NODE to allow proper Electron initialization
      const electronEnv = { ...process.env, NODE_ENV: 'development' }
      delete electronEnv.ELECTRON_RUN_AS_NODE
      delete electronEnv.ELECTRON_NO_ATTACH_CONSOLE

      const electron = spawn(path.join(__dirname, 'node_modules', '.bin', 'electron'), ['.'], {
        stdio: 'inherit',
        shell: true,
        env: electronEnv
      })

      electron.on('exit', () => {
        vite.kill()
        process.exit()
      })
    } else {
      console.error('TypeScript compilation failed')
      vite.kill()
      process.exit(1)
    }
  })
}, 2000)

process.on('SIGINT', () => {
  vite.kill()
  process.exit()
})
