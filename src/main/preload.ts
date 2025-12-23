/**
 * Preload Script
 * Exposes safe API to renderer process
 */
import { contextBridge, ipcRenderer } from 'electron'
import { AppConfig, FolderConfig, ScheduleConfig, Group, SyncStatus, SyncRun, SyncFilesResponse } from '../shared/types'

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  error?: string
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: (): Promise<AppConfig | null> => ipcRenderer.invoke('get-config'),
  setConfig: (apiToken: string): Promise<{ success: boolean; companyName?: string; integrationId?: string; error?: string }> =>
    ipcRenderer.invoke('set-config', apiToken),

  // Folders
  getFolders: (): Promise<FolderConfig[]> => ipcRenderer.invoke('get-folders'),
  addFolder: (folder: Omit<FolderConfig, 'id'>): Promise<number> => ipcRenderer.invoke('add-folder', folder),
  updateFolder: (id: number, folder: Partial<Omit<FolderConfig, 'id'>>): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('update-folder', id, folder),
  deleteFolder: (id: number): Promise<{ success: boolean }> => ipcRenderer.invoke('delete-folder', id),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),

  // Groups
  getGroups: (): Promise<Group[]> => ipcRenderer.invoke('get-groups'),

  // Sync
  startSync: (triggeredBy?: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('start-sync', triggeredBy),
  getSyncStatus: (): Promise<SyncStatus> => ipcRenderer.invoke('get-sync-status'),
  isSyncRunning: (): Promise<boolean> => ipcRenderer.invoke('is-sync-running'),
  onSyncStatusUpdate: (callback: (status: SyncStatus) => void) => {
    ipcRenderer.on('sync-status-update', (_, status) => callback(status))
  },
  offSyncStatusUpdate: () => {
    ipcRenderer.removeAllListeners('sync-status-update')
  },

  // Schedule
  getSchedule: (): Promise<ScheduleConfig | null> => ipcRenderer.invoke('get-schedule'),
  setSchedule: (config: ScheduleConfig): Promise<{ success: boolean }> => ipcRenderer.invoke('set-schedule', config),

  // Stats
  getStats: (): Promise<{ totalFiles: number; failedFiles: number; lastSyncAt: number | null }> =>
    ipcRenderer.invoke('get-stats'),
  getSyncHistory: (limit?: number): Promise<{ syncRuns: SyncRun[]; total: number }> =>
    ipcRenderer.invoke('get-sync-history', limit),
  getSyncFiles: (syncRunId: string, options?: { status?: string; limit?: number }): Promise<SyncFilesResponse> =>
    ipcRenderer.invoke('get-sync-files', syncRunId, options),

  // Auto-updater
  checkForUpdates: (): Promise<{ success: boolean; version?: string; error?: string }> =>
    ipcRenderer.invoke('check-for-updates'),
  installUpdate: (): void => {
    ipcRenderer.invoke('install-update')
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    ipcRenderer.on('update-status', (_, status) => callback(status))
  },
  offUpdateStatus: () => {
    ipcRenderer.removeAllListeners('update-status')
  },
})
