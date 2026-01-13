/**
 * Electron Main Process
 */
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import os from 'os'
import { autoUpdater } from 'electron-updater'
import { DatabaseManager } from './database'
import { SyncEngine } from './sync-engine'
import { SyncScheduler } from './scheduler'
import { ApiClient } from './api-client'
import { AppConfig, FolderConfig, ScheduleConfig, Group } from '../shared/types'

// Set app name (shown in dock tooltip and menu bar)
app.setName('Lina Sync')

// Configure auto-updater
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null
let db: DatabaseManager
let syncEngine: SyncEngine
let scheduler: SyncScheduler

function createWindow() {
  // Get icon path based on platform
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, '../../../build/icon.icns')
    : path.join(__dirname, '../../../build/icon.png')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, __dirname is dist/main/main/, so we need to go up 2 levels
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  // Intercept close event to warn if sync is in progress
  mainWindow.on('close', (event) => {
    if (syncEngine.isSyncRunning()) {
      const choice = dialog.showMessageBoxSync(mainWindow!, {
        type: 'warning',
        buttons: ['Cancelar', 'Cerrar de todos modos'],
        defaultId: 0,
        cancelId: 0,
        title: 'Sincronización en progreso',
        message: 'Hay una sincronización en progreso.',
        detail: 'Si cierras la aplicación ahora, los archivos que aún no se han subido no se sincronizarán. Los archivos ya subidos continuarán procesándose en el servidor.\n\n¿Deseas cerrar de todos modos?'
      })

      if (choice === 0) {
        // User clicked "Cancelar" - prevent close
        event.preventDefault()
      }
      // If choice === 1, allow the window to close
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Set up sync engine with main window for status updates
  syncEngine.setMainWindow(mainWindow)

  // Set up auto-updater events
  setupAutoUpdater()
}

function setupAutoUpdater() {
  // Check for updates after window is ready
  autoUpdater.checkForUpdates().catch((err) => {
    console.log('Update check failed:', err.message)
  })

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...')
    mainWindow?.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: info.version
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available')
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    mainWindow?.webContents.send('update-status', {
      status: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err.message)
    mainWindow?.webContents.send('update-status', {
      status: 'error',
      error: err.message
    })
  })
}

// App lifecycle
app.whenReady().then(() => {
  // Set dock icon on macOS (for development mode)
  if (process.platform === 'darwin' && app.dock) {
    const dockIconPath = path.join(__dirname, '../../../build/icon.png')
    app.dock.setIcon(dockIconPath)
  }

  // Initialize database and services
  db = new DatabaseManager()
  syncEngine = new SyncEngine(db)
  scheduler = new SyncScheduler(db, syncEngine)

  createWindow()

  // Start scheduler if configured
  scheduler.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    scheduler.stop()
    db.close()
    app.quit()
  }
})

app.on('before-quit', () => {
  scheduler.stop()
  db.close()
})

// IPC Handlers

// Config
ipcMain.handle('get-config', async (): Promise<AppConfig | null> => {
  const apiToken = db.getConfig('apiToken')
  const integrationId = db.getConfig('integrationId')
  const companyId = db.getConfig('companyId')
  const companyName = db.getConfig('companyName')

  if (!apiToken) return null

  return {
    apiToken,
    integrationId: integrationId || '',
    companyId: companyId || '',
    companyName: companyName || '',
  }
})

ipcMain.handle('set-config', async (_, apiToken: string) => {
  // Validate token by calling /me endpoint
  const apiClient = new ApiClient(apiToken)

  try {
    const info = await apiClient.getMyIntegration()

    // Save all config
    db.setConfig('apiToken', apiToken)
    db.setConfig('integrationId', info.integrationId)
    db.setConfig('companyId', info.companyId)
    db.setConfig('companyName', info.companyName)

    // Set machine ID if not already set
    if (!db.getConfig('machineId')) {
      db.setConfig('machineId', os.hostname())
    }

    return {
      success: true,
      companyName: info.companyName,
      integrationId: info.integrationId,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message || 'Invalid API token',
    }
  }
})

// Folders
ipcMain.handle('get-folders', async (): Promise<FolderConfig[]> => {
  return db.getFolderConfigs()
})

ipcMain.handle('add-folder', async (_, folder: Omit<FolderConfig, 'id'>): Promise<number> => {
  return db.addFolderConfig(folder)
})

ipcMain.handle('update-folder', async (_, id: number, folder: Partial<Omit<FolderConfig, 'id'>>) => {
  db.updateFolderConfig(id, folder)
  return { success: true }
})

ipcMain.handle('delete-folder', async (_, id: number) => {
  db.deleteFolderConfig(id)
  return { success: true }
})

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

// Groups
ipcMain.handle('get-groups', async (): Promise<Group[]> => {
  const apiToken = db.getConfig('apiToken')
  const integrationId = db.getConfig('integrationId')

  if (!apiToken || !integrationId) return []

  const apiClient = new ApiClient(apiToken)
  try {
    return await apiClient.getGroups(integrationId)
  } catch (error) {
    console.error('Failed to fetch groups:', error)
    return []
  }
})

// Sync
ipcMain.handle('start-sync', async (_, triggeredBy: string = 'manual') => {
  try {
    await syncEngine.performSync(triggeredBy)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('get-sync-status', async () => {
  return syncEngine.getStatus()
})

ipcMain.handle('is-sync-running', async () => {
  return syncEngine.isSyncRunning()
})

// Schedule
ipcMain.handle('get-schedule', async (): Promise<ScheduleConfig | null> => {
  return scheduler.getSchedule()
})

ipcMain.handle('set-schedule', async (_, config: ScheduleConfig) => {
  scheduler.setSchedule(config)
  return { success: true }
})

// Stats
ipcMain.handle('get-stats', async () => {
  const allFiles = db.getFilesByStatus('synced')
  const failedFiles = db.getFilesByStatus('failed')
  const lastSyncAt = db.getConfig('lastSyncAt')

  return {
    totalFiles: allFiles.length,
    failedFiles: failedFiles.length,
    lastSyncAt: lastSyncAt ? parseInt(lastSyncAt) : null,
  }
})

// Sync History
ipcMain.handle('get-sync-history', async (_, limit: number = 20) => {
  const apiToken = db.getConfig('apiToken')
  const integrationId = db.getConfig('integrationId')

  if (!apiToken || !integrationId) return { syncRuns: [], total: 0 }

  const apiClient = new ApiClient(apiToken)
  try {
    return await apiClient.getSyncRuns(integrationId, limit)
  } catch (error) {
    console.error('Failed to fetch sync history:', error)
    return { syncRuns: [], total: 0 }
  }
})

// Sync Files (per-file details for a sync run)
ipcMain.handle('get-sync-files', async (_, syncRunId: string, options?: { status?: string; limit?: number }) => {
  const apiToken = db.getConfig('apiToken')
  const integrationId = db.getConfig('integrationId')

  if (!apiToken || !integrationId) return { files: [], total: 0, byStatus: {}, byErrorCode: {} }

  const apiClient = new ApiClient(apiToken)
  try {
    return await apiClient.getSyncFiles(integrationId, syncRunId, options)
  } catch (error) {
    console.error('Failed to fetch sync files:', error)
    return { files: [], total: 0, byStatus: {}, byErrorCode: {} }
  }
})

// Auto-updater
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    return { success: true, version: result?.updateInfo?.version }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true)
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})
