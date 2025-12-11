/**
 * Sync Engine
 * Orchestrates file synchronization with backend
 */
import path from 'path'
import os from 'os'
import { DatabaseManager } from './database'
import { FileScanner } from './scanner'
import { ApiClient } from './api-client'
import { SyncStatus, FileRecord, AppConfig } from '../shared/types'
import { BrowserWindow } from 'electron'
import { needsConversion, convertFile } from './file-converter'

export class SyncEngine {
  private db: DatabaseManager
  private scanner: FileScanner
  private apiClient: ApiClient | null = null
  private isRunning = false
  private currentSyncRunId: string | null = null
  private syncStatus: SyncStatus = {
    isRunning: false,
    currentSyncRunId: null,
    lastSyncAt: null,
    filesScanned: 0,
    filesNew: 0,
    filesUpdated: 0,
    filesDeleted: 0,
    filesFailed: 0,
    filesSkipped: 0,
    bytesProcessed: 0,
    progress: 0,
  }
  private mainWindow: BrowserWindow | null = null

  constructor(db: DatabaseManager) {
    this.db = db
    this.scanner = new FileScanner()
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * Initialize API client with config from database
   */
  private initializeApiClient(): boolean {
    const apiToken = this.db.getConfig('apiToken')

    if (!apiToken) {
      return false
    }

    this.apiClient = new ApiClient(apiToken)
    return true
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Check if sync is currently running
   */
  isSyncRunning(): boolean {
    return this.isRunning
  }

  /**
   * Perform a full sync
   */
  async performSync(triggeredBy: string = 'manual'): Promise<void> {
    if (this.isRunning) {
      throw new Error('Sync already running')
    }

    if (!this.initializeApiClient()) {
      throw new Error('API not configured. Please configure API settings first.')
    }

    this.isRunning = true
    this.syncStatus = {
      isRunning: true,
      currentSyncRunId: null,
      lastSyncAt: null,
      filesScanned: 0,
      filesNew: 0,
      filesUpdated: 0,
      filesDeleted: 0,
      filesFailed: 0,
      filesSkipped: 0,
      bytesProcessed: 0,
      progress: 0,
    }
    // Collect error details for failed files
    const failedFilesDetails: Array<{ fileName: string; filePath: string; error: string }> = []
    this.sendStatusUpdate()

    try {
      const integrationId = this.db.getConfig('integrationId')
      if (!integrationId) {
        throw new Error('Integration ID not configured')
      }

      // Create sync run
      const syncRun = await this.apiClient!.createSyncRun(integrationId, triggeredBy)
      this.currentSyncRunId = syncRun.id
      this.syncStatus.currentSyncRunId = syncRun.id
      this.sendStatusUpdate()

      // Get folder configs
      const folderConfigs = this.db.getFolderConfigs().filter(fc => fc.enabled)
      if (folderConfigs.length === 0) {
        throw new Error('No folder configurations found')
      }

      // Phase 1: Scan all folders
      console.log('Phase 1: Scanning folders...')
      const scannedFiles = new Map<string, any>()
      for (const config of folderConfigs) {
        const files = await this.scanner.scanFolder(config)
        for (const file of files) {
          scannedFiles.set(file.filePath, {
            ...file,
            groupIds: config.groupIds,
          })
        }
      }

      this.syncStatus.filesScanned = scannedFiles.size
      this.syncStatus.progress = 10
      this.sendStatusUpdate()

      // Phase 2: Check which files need to be uploaded
      console.log('Phase 2: Checking for changes...')
      const allHashes = Array.from(scannedFiles.values()).map(f => f.fileHash)
      console.log(`Checking ${allHashes.length} hashes with backend...`)
      const hashCheckResults = await this.apiClient!.checkHashes(integrationId, allHashes)
      console.log(`Backend returned ${hashCheckResults.size} hash results`)

      const filesToUpload: any[] = []
      const filesUnchanged: any[] = []

      for (const [filePath, fileData] of scannedFiles) {
        const existingFile = this.db.getFileByPath(filePath)
        const hashResult = hashCheckResults.get(fileData.fileHash)

        // Check if file was modified locally (comparing DB hash vs current file hash)
        const wasModified = existingFile && existingFile.fileHash !== fileData.fileHash

        if (!hashResult?.exists) {
          // Hash not found on server - upload it
          const uploadType = existingFile ? 'updated' : 'new'
          filesToUpload.push({ ...fileData, uploadType })
        } else if (wasModified) {
          // Hash exists on server but local file was modified
          // The new content matches existing content on server
          // Just update local DB to point to existing document
          this.syncStatus.filesUpdated++
          this.db.upsertFile({
            filePath: fileData.filePath,
            fileHash: fileData.fileHash,
            fileSize: fileData.fileSize,
            lastModified: fileData.lastModified,
            documentId: hashResult?.documentId || null,
            folderConfigId: fileData.folderConfigId,
            lastSyncedAt: Date.now(),
            status: 'synced',
            errorMessage: null,
          })
        } else {
          // Unchanged file - already exists on server with same hash
          filesUnchanged.push(fileData)
          this.syncStatus.filesSkipped++
          this.db.upsertFile({
            filePath: fileData.filePath,
            fileHash: fileData.fileHash,
            fileSize: fileData.fileSize,
            lastModified: fileData.lastModified,
            documentId: hashResult?.documentId || null,
            folderConfigId: fileData.folderConfigId,
            lastSyncedAt: Date.now(),
            status: 'synced',
            errorMessage: null,
          })
        }
      }

      console.log(`Sync check: ${filesToUpload.filter(f => f.uploadType === 'new').length} new, ${filesToUpload.filter(f => f.uploadType === 'updated').length} updated, ${this.syncStatus.filesSkipped} unchanged`)

      this.syncStatus.progress = 30
      this.sendStatusUpdate()

      // Phase 3: Upload new/modified files in batches
      if (filesToUpload.length > 0) {
        console.log(`Phase 3: Uploading ${filesToUpload.length} files...`)
        const batchSize = 10
        const machineId = this.db.getConfig('machineId') || os.hostname()
        const osType = os.platform()

        for (let i = 0; i < filesToUpload.length; i += batchSize) {
          const batch = filesToUpload.slice(i, i + batchSize)

          // Prepare upload data, converting files if needed (e.g., XML -> JSON)
          const uploadData = await Promise.all(batch.map(async f => {
            const baseData = {
              filePath: f.filePath,
              fileHash: f.fileHash,
              fileName: path.basename(f.filePath),
              fileSize: f.fileSize,
              folderConfigId: f.folderConfigId,
              groupIds: f.groupIds,
              localPath: f.filePath,
            }

            // Check if file needs conversion (e.g., XML -> JSON)
            if (needsConversion(f.filePath)) {
              const converted = await convertFile(f.filePath)
              if (converted) {
                console.log(`Converting ${converted.originalFileName} -> ${converted.convertedFileName}`)
                return {
                  ...baseData,
                  fileName: converted.convertedFileName,
                  convertedContent: converted.content,
                  originalFileName: converted.originalFileName,
                  convertedFrom: converted.convertedFrom,
                }
              }
            }

            return baseData
          }))

          try {
            const results = await this.apiClient!.uploadBatch(
              integrationId,
              uploadData,
              machineId,
              osType
            )

            // Update database with results
            for (let j = 0; j < results.length; j++) {
              const result = results[j]
              const fileData = batch[j]

              if (result.status === 'success') {
                this.db.upsertFile({
                  filePath: fileData.filePath,
                  fileHash: fileData.fileHash,
                  fileSize: fileData.fileSize,
                  lastModified: fileData.lastModified,
                  documentId: result.documentId || null,
                  folderConfigId: fileData.folderConfigId,
                  lastSyncedAt: Date.now(),
                  status: 'synced',
                  errorMessage: null,
                })
                this.syncStatus.bytesProcessed += fileData.fileSize
                // Count successful uploads by type
                if (fileData.uploadType === 'new') {
                  this.syncStatus.filesNew++
                } else if (fileData.uploadType === 'updated') {
                  this.syncStatus.filesUpdated++
                }
              } else {
                const errorMsg = result.errorMessage || 'Upload failed'
                this.db.upsertFile({
                  filePath: fileData.filePath,
                  fileHash: fileData.fileHash,
                  fileSize: fileData.fileSize,
                  lastModified: fileData.lastModified,
                  documentId: null,
                  folderConfigId: fileData.folderConfigId,
                  lastSyncedAt: null,
                  status: 'failed',
                  errorMessage: errorMsg,
                })
                this.syncStatus.filesFailed++
                // Collect error details for backend
                failedFilesDetails.push({
                  fileName: path.basename(fileData.filePath),
                  filePath: fileData.filePath,
                  error: errorMsg,
                })
              }
            }
          } catch (error) {
            console.error('Batch upload error:', error)
            const errorMsg = String(error)
            // Mark all files in batch as failed
            for (const fileData of batch) {
              this.db.upsertFile({
                filePath: fileData.filePath,
                fileHash: fileData.fileHash,
                fileSize: fileData.fileSize,
                lastModified: fileData.lastModified,
                documentId: null,
                folderConfigId: fileData.folderConfigId,
                lastSyncedAt: null,
                status: 'failed',
                errorMessage: errorMsg,
              })
              this.syncStatus.filesFailed++
              // Collect error details for backend
              failedFilesDetails.push({
                fileName: path.basename(fileData.filePath),
                filePath: fileData.filePath,
                error: errorMsg,
              })
            }
          }

          this.syncStatus.progress = 30 + Math.floor((i / filesToUpload.length) * 50)
          this.sendStatusUpdate()
        }
      }

      this.syncStatus.progress = 80
      this.sendStatusUpdate()

      // Phase 4: Delete files that no longer exist locally
      console.log('Phase 4: Checking for deleted files...')
      const allTrackedFiles = this.db.getFilesByStatus('synced')
      const filesToDelete: string[] = []

      for (const trackedFile of allTrackedFiles) {
        if (!scannedFiles.has(trackedFile.filePath) && !this.scanner.fileExists(trackedFile.filePath)) {
          filesToDelete.push(trackedFile.fileHash)
          this.syncStatus.filesDeleted++
        }
      }

      if (filesToDelete.length > 0) {
        try {
          await this.apiClient!.deleteBatch(integrationId, filesToDelete)
          // Remove from database
          const pathsToDelete = allTrackedFiles
            .filter(f => filesToDelete.includes(f.fileHash))
            .map(f => f.filePath)
          this.db.deleteFilesByPaths(pathsToDelete)
        } catch (error) {
          console.error('Batch delete error:', error)
        }
      }

      this.syncStatus.progress = 95
      this.sendStatusUpdate()

      // Complete sync run
      const finalStatus = this.syncStatus.filesFailed > 0 ? 'partial' : 'completed'
      await this.apiClient!.completeSyncRun(integrationId, syncRun.id, finalStatus, {
        filesScanned: this.syncStatus.filesScanned,
        filesNew: this.syncStatus.filesNew,
        filesUpdated: this.syncStatus.filesUpdated,
        filesDeleted: this.syncStatus.filesDeleted,
        filesFailed: this.syncStatus.filesFailed,
        filesSkipped: this.syncStatus.filesSkipped,
        bytesProcessed: this.syncStatus.bytesProcessed,
        errorDetails: failedFilesDetails.length > 0 ? failedFilesDetails : undefined,
      })

      this.syncStatus.lastSyncAt = Date.now()
      this.syncStatus.progress = 100
      this.db.setConfig('lastSyncAt', String(this.syncStatus.lastSyncAt))

      console.log('Sync completed successfully')
    } catch (error) {
      console.error('Sync error:', error)

      // Try to mark sync run as failed
      if (this.currentSyncRunId && this.apiClient) {
        try {
          const integrationId = this.db.getConfig('integrationId')
          if (integrationId) {
            await this.apiClient.completeSyncRun(integrationId, this.currentSyncRunId, 'failed', {
              filesScanned: this.syncStatus.filesScanned,
              filesNew: this.syncStatus.filesNew,
              filesUpdated: this.syncStatus.filesUpdated,
              filesDeleted: this.syncStatus.filesDeleted,
              filesFailed: this.syncStatus.filesFailed,
              filesSkipped: this.syncStatus.filesSkipped,
              bytesProcessed: this.syncStatus.bytesProcessed,
              errorMessage: String(error),
              errorDetails: failedFilesDetails.length > 0 ? failedFilesDetails : undefined,
            })
          }
        } catch (completeError) {
          console.error('Failed to mark sync run as failed:', completeError)
        }
      }

      throw error
    } finally {
      this.isRunning = false
      this.currentSyncRunId = null
      this.syncStatus.isRunning = false
      this.syncStatus.currentSyncRunId = null
      this.sendStatusUpdate()
    }
  }

  /**
   * Send status update to renderer process
   */
  private sendStatusUpdate() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync-status-update', this.syncStatus)
    }
  }
}
