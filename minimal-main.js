// Minimal Electron entry point for testing
console.log('=== Starting minimal Electron test ===')
console.log('Node version:', process.version)
console.log('Process type:', process.type)
console.log('Electron versions:', process.versions)

// Try to require electron
let electron
try {
  electron = require('electron')
  console.log('electron require result type:', typeof electron)
  console.log('electron keys:', Object.keys(electron).slice(0, 10))
} catch (error) {
  console.error('Failed to require electron:', error)
  process.exit(1)
}

const { app, BrowserWindow } = electron

console.log('app type:', typeof app)
console.log('BrowserWindow type:', typeof BrowserWindow)

if (!app) {
  console.error('ERROR: app is undefined!')
  console.error('Full electron object:', electron)
  process.exit(1)
}

app.whenReady().then(() => {
  console.log('✓ Electron app ready!')

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadURL('data:text/html,<h1>Electron Works!</h1>')
  console.log('✓ Window created successfully!')
})

app.on('window-all-closed', () => {
  app.quit()
})
