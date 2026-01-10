/**
 * Sync Engine
 * Orchestrates file synchronization with backend
 */
import path from 'path'
import os from 'os'
import { DatabaseManager } from './database'
import { FileScanner } from './scanner'
import { ApiClient } from './api-client'
import { S3UploadService } from './s3-upload-service'
import { SyncStatus } from '../shared/types'
import { BrowserWindow } from 'electron'

export class SyncEngine {
  private db: DatabaseManager
  private scanner: FileScanner
  private apiClient: ApiClient | null = null
  private s3UploadService: S3UploadService | null = null
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
    filesCompleted: 0,
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
    this.s3UploadService = new S3UploadService(this.apiClient)
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
      filesCompleted: 0,
      bytesProcessed: 0,
      progress: 0,
    }
    // Collect error details for failed files
    const failedFilesDetails: Array<{ fileName: string; filePath: string; error: string }> = []
    // Track sync start time and hash check info for logging
    const syncStartTime = Date.now()
    let hashCheckInfo = { totalFiles: 0, alreadyOnServer: 0, newToUpload: 0 }
    let uploadMethod = 'direct'
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

      // Update hash check info for logging
      hashCheckInfo = {
        totalFiles: allHashes.length,
        alreadyOnServer: filesUnchanged.length,
        newToUpload: filesToUpload.length,
      }

      this.syncStatus.progress = 30
      this.sendStatusUpdate()

      // Phase 3: Upload new/modified files via S3
      // All uploads go through S3 -> Lambda for consistent processing
      uploadMethod = 's3'
      if (filesToUpload.length > 0) {
        const machineId = this.db.getConfig('machineId') || os.hostname()
        const osType = os.platform()

        console.log(`Phase 3: Uploading ${filesToUpload.length} files via S3...`)
        await this.performS3Upload(
          integrationId,
          filesToUpload,
          machineId,
          osType,
          failedFilesDetails,
          syncRun.id
        )
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

      // Complete sync run only if no files were uploaded
      // When files are uploaded via S3, the Lambda handles completion
      if (filesToUpload.length === 0) {
        await this.apiClient!.completeSyncRun(integrationId, syncRun.id, 'completed', {
          filesScanned: this.syncStatus.filesScanned,
          filesNew: 0,
          filesUpdated: 0,
          filesDeleted: this.syncStatus.filesDeleted,
          filesFailed: 0,
          filesSkipped: this.syncStatus.filesSkipped,
          bytesProcessed: 0,
          logSummary: {
            hashCheck: hashCheckInfo,
            uploadMethod: 'none',
            durationMs: Date.now() - syncStartTime,
          },
        })
      }

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
              logSummary: {
                hashCheck: hashCheckInfo,
                uploadMethod: uploadMethod,
                durationMs: Date.now() - syncStartTime,
              },
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
   * Perform S3 upload - all files go through S3 -> Lambda for processing
   */
  private async performS3Upload(
    integrationId: string,
    filesToUpload: any[],
    machineId: string,
    osType: string,
    failedFilesDetails: Array<{ fileName: string; filePath: string; error: string }>,
    syncRunId: string
  ): Promise<void> {
    // Prepare files for S3 upload
    const s3Files = filesToUpload.map(f => ({
      filePath: f.filePath,
      fileHash: f.fileHash,
      fileName: path.basename(f.filePath),
      fileSize: f.fileSize,
      folderConfigId: f.folderConfigId,
      groupIds: f.groupIds || [],
      lastModified: f.lastModified,
    }))

    try {
      // Upload to S3 using the service (pass existing syncRunId to avoid creating duplicate)
      const result = await this.s3UploadService!.uploadBatch(
        integrationId,
        s3Files,
        machineId,
        osType,
        (uploaded, total) => {
          // Update progress during S3 upload phase (30-60%)
          this.syncStatus.progress = 30 + Math.floor((uploaded / total) * 30)
          this.sendStatusUpdate()
        },
        syncRunId
      )

      console.log(`[S3Upload] Upload complete. Uploaded: ${result.uploaded.length}, Failed: ${result.failed.length}, Skipped: ${result.skipped.length}`)

      // Update local DB for uploaded files (mark as syncing, will be updated when processing completes)
      const uploadedSet = new Set(result.uploaded)
      const skippedSet = new Set(result.skipped)

      for (const fileData of filesToUpload) {
        if (uploadedSet.has(fileData.fileHash)) {
          // File uploaded to S3, processing async - mark as pending until processing completes
          this.db.upsertFile({
            filePath: fileData.filePath,
            fileHash: fileData.fileHash,
            fileSize: fileData.fileSize,
            lastModified: fileData.lastModified,
            documentId: null,
            folderConfigId: fileData.folderConfigId,
            lastSyncedAt: null,
            status: 'pending',
            errorMessage: null,
          })
          this.syncStatus.bytesProcessed += fileData.fileSize
          if (fileData.uploadType === 'new') {
            this.syncStatus.filesNew++
          } else if (fileData.uploadType === 'updated') {
            this.syncStatus.filesUpdated++
          }
        } else if (skippedSet.has(fileData.fileHash)) {
          // Already exists on server
          this.syncStatus.filesSkipped++
        }
      }

      // Handle failed uploads
      for (const failed of result.failed) {
        const fileData = filesToUpload.find(f => f.fileHash === failed.fileHash)
        if (fileData) {
          this.db.upsertFile({
            filePath: fileData.filePath,
            fileHash: fileData.fileHash,
            fileSize: fileData.fileSize,
            lastModified: fileData.lastModified,
            documentId: null,
            folderConfigId: fileData.folderConfigId,
            lastSyncedAt: null,
            status: 'failed',
            errorMessage: failed.error,
          })
          this.syncStatus.filesFailed++
          failedFilesDetails.push({
            fileName: path.basename(fileData.filePath),
            filePath: fileData.filePath,
            error: failed.error,
          })
        }
      }

      // Poll for processing completion (60-80%)
      console.log(`[S3Upload] Waiting for backend processing...`)
      const finalStatus = await this.s3UploadService!.pollSyncStatus(
        integrationId,
        result.syncRunId,
        (status) => {
          // Update progress during processing phase (60-80%)
          const processingProgress = status.progressPercent || 0
          this.syncStatus.progress = 60 + Math.floor(processingProgress * 0.2)
          this.sendStatusUpdate()

          console.log(`[S3Upload] Processing: ${status.filesCompleted}/${status.filesProcessing + status.filesCompleted} complete`)
        },
        3000 // Poll every 3 seconds
      )

      // Update local sync status with Lambda's processing results
      // This ensures the UI shows accurate counts (e.g., files that failed during processing)
      this.syncStatus.filesCompleted = finalStatus.filesCompleted
      this.syncStatus.filesFailed = finalStatus.filesFailed
      this.syncStatus.filesSkipped = finalStatus.filesSkipped

      console.log(`[S3Upload] Processing complete. Completed: ${finalStatus.filesCompleted}, Failed: ${finalStatus.filesFailed}, Skipped: ${finalStatus.filesSkipped}`)
      this.sendStatusUpdate()

    } catch (error) {
      console.error('[S3Upload] Error:', error)
      const errorMsg = String(error)

      // Mark all files as failed
      for (const fileData of filesToUpload) {
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
        failedFilesDetails.push({
          fileName: path.basename(fileData.filePath),
          filePath: fileData.filePath,
          error: errorMsg,
        })
      }
    }
  }

  /**
   * Check for and optionally resume an incomplete sync
   */
  async checkAndResumeIncompleteSync(): Promise<boolean> {
    if (!this.initializeApiClient()) {
      return false
    }

    const integrationId = this.db.getConfig('integrationId')
    if (!integrationId) {
      return false
    }

    try {
      const incompleteSync = await this.s3UploadService!.checkForIncompleteSyncs(integrationId)

      if (incompleteSync) {
        console.log(`[SyncEngine] Found incomplete sync: ${incompleteSync.id}`)

        const shouldResume = await this.s3UploadService!.promptResumeSync(
          incompleteSync.filesCompleted,
          incompleteSync.filesPending
        )

        if (shouldResume) {
          console.log(`[SyncEngine] Resuming sync ${incompleteSync.id}...`)
          // TODO: Implement actual resume logic
          return true
        }
      }

      return false
    } catch (error) {
      console.error('[SyncEngine] Error checking for incomplete syncs:', error)
      return false
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
