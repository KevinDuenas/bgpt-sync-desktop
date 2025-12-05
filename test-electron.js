// Simple test to see if Electron loads correctly
const { app, BrowserWindow } = require('electron')

console.log('Electron loaded:', {
  app: !!app,
  BrowserWindow: !!BrowserWindow
})

if (app) {
  app.whenReady().then(() => {
    console.log('Electron app ready!')
    const win = new BrowserWindow({ width: 800, height: 600 })
    win.loadURL('https://www.google.com')
  })
} else {
  console.error('app is undefined!')
}
