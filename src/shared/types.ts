/**
 * Shared types between main and renderer processes
 */

export interface AppConfig {
  apiToken: string
  integrationId: string
  companyId: string
  companyName: string
}

export interface FolderConfig {
  id: number
  localPath: string
  includeSubfolders: boolean
  fileExtensions: string[] | null // null = all files
  maxFileSizeMb: number | null // null = no limit
  groupIds: string[]
  ignoreHidden: boolean
  enabled: boolean
}

export interface FileRecord {
  id: number
  filePath: string
  fileHash: string
  fileSize: number
  lastModified: number
  documentId: string | null
  folderConfigId: number
  lastSyncedAt: number | null
  status: 'pending' | 'synced' | 'failed' | 'deleted'
  errorMessage: string | null
}

export interface SyncStatus {
  isRunning: boolean
  currentSyncRunId: string | null
  lastSyncAt: number | null
  filesScanned: number
  filesNew: number
  filesUpdated: number
  filesDeleted: number
  filesFailed: number
  filesSkipped: number
  filesCompleted: number  // Successfully processed by Lambda
  bytesProcessed: number
  progress: number // 0-100
}

export interface SyncRun {
  id: string
  integrationId: string
  status: 'running' | 'completed' | 'failed' | 'partial'
  triggeredBy: string
  startedAt: string
  completedAt: string | null
  filesScanned: number
  filesNew: number
  filesUpdated: number
  filesDeleted: number
  filesFailed: number
  filesSkipped: number
  filesCompleted: number  // Successfully processed by Lambda
  bytesProcessed: number
  errorMessage: string | null
}

export interface Group {
  id: string
  name: string
  isSystem: boolean
}

export interface ScheduleConfig {
  enabled: boolean
  frequency: 'hourly' | 'daily' | 'weekly' | 'manual'
  time?: string // HH:MM for daily
  dayOfWeek?: number // 0-6 for weekly
  cronExpression?: string // custom cron
}

export interface SyncFileDetail {
  id: string
  fileName: string
  fileHash: string
  fileSize: number
  status: string
  errorCode: string | null
  lastError: string | null
  retryCount: number
  createdAt: string
  updatedAt: string | null
  processedAt: string | null
}

export interface SyncFilesResponse {
  files: SyncFileDetail[]
  total: number
  byStatus: Record<string, number>
  byErrorCode: Record<string, number>
}
