/**
 * Global type definitions for Electron API
 */
import { AppConfig, FolderConfig, ScheduleConfig, Group, SyncStatus, SyncRun } from '../shared/types'

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  error?: string
}

declare global {
  interface Window {
    electronAPI: {
      // Config
      getConfig: () => Promise<AppConfig | null>
      setConfig: (apiToken: string) => Promise<{ success: boolean; companyName?: string; integrationId?: string; error?: string }>

      // Folders
      getFolders: () => Promise<FolderConfig[]>
      addFolder: (folder: Omit<FolderConfig, 'id'>) => Promise<number>
      updateFolder: (id: number, folder: Partial<Omit<FolderConfig, 'id'>>) => Promise<{ success: boolean }>
      deleteFolder: (id: number) => Promise<{ success: boolean }>
      selectFolder: () => Promise<string | null>

      // Groups
      getGroups: () => Promise<Group[]>

      // Sync
      startSync: (triggeredBy?: string) => Promise<{ success: boolean; error?: string }>
      getSyncStatus: () => Promise<SyncStatus>
      isSyncRunning: () => Promise<boolean>
      onSyncStatusUpdate: (callback: (status: SyncStatus) => void) => void
      offSyncStatusUpdate: () => void

      // Schedule
      getSchedule: () => Promise<ScheduleConfig | null>
      setSchedule: (config: ScheduleConfig) => Promise<{ success: boolean }>

      // Stats
      getStats: () => Promise<{ totalFiles: number; failedFiles: number; lastSyncAt: number | null }>
      getSyncHistory: (limit?: number) => Promise<{ syncRuns: SyncRun[]; total: number }>

      // Auto-updater
      checkForUpdates: () => Promise<{ success: boolean; version?: string; error?: string }>
      installUpdate: () => void
      getAppVersion: () => Promise<string>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => void
      offUpdateStatus: () => void
    }
  }
}

export {}
