/**
 * S3 Upload Service
 *
 * Handles the new async upload flow:
 * 1. Request presigned URLs from backend
 * 2. Upload files directly to S3
 * 3. Confirm uploads to trigger processing
 * 4. Poll for completion status
 */
import fs from 'fs'
import { dialog } from 'electron'
import axios from 'axios'
import { ApiClient, S3BatchUploadResponse, S3SyncStatus, ResumeSyncResponse } from './api-client'

// Concurrency limit for S3 uploads
const UPLOAD_CONCURRENCY = 5

/**
 * Extended file info for S3 upload (includes fileName and groupIds from sync engine)
 */
export interface S3UploadFile {
  filePath: string
  fileHash: string
  fileName: string
  fileSize: number
  lastModified: number
  folderConfigId: number
  groupIds: string[]
  /** Optional converted content buffer (e.g., XML converted to JSON) */
  convertedContent?: Buffer
  /** Original filename before conversion */
  originalFileName?: string
}

export interface S3UploadResult {
  syncRunId: string
  uploaded: string[]  // file hashes
  failed: Array<{ fileHash: string; error: string }>
  skipped: string[]  // file hashes
}

export class S3UploadService {
  private apiClient: ApiClient

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Upload files to S3 using the new async flow
   */
  async uploadBatch(
    integrationId: string,
    files: S3UploadFile[],
    machineId: string,
    os: string,
    onProgress: (uploaded: number, total: number) => void,
    existingSyncRunId?: string
  ): Promise<S3UploadResult> {
    // 1. Request presigned URLs from backend
    console.log(`[S3Upload] Requesting presigned URLs for ${files.length} files`)
    const response = await this.apiClient.requestBatchUpload(
      integrationId,
      files.map(f => ({
        fileHash: f.fileHash,
        fileName: f.fileName,
        fileSize: f.fileSize,
        folderConfigId: f.folderConfigId,
        groupIds: f.groupIds,
        localPath: f.filePath,
      })),
      machineId,
      os,
      existingSyncRunId
    )

    // Check if confirmation is required for large uploads
    if (response.requiresConfirmation) {
      const confirmed = await this.showLargeUploadConfirmation(
        files.length,
        response.totalSizeBytes
      )
      if (!confirmed) {
        throw new Error('Upload cancelled by user')
      }
    }

    const { syncRunId, uploads, skipped } = response

    // If no new files to upload, return early
    if (uploads.length === 0) {
      console.log(`[S3Upload] No new files to upload, all skipped`)
      return {
        syncRunId,
        uploaded: [],
        failed: [],
        skipped: skipped.map(s => s.fileHash),
      }
    }

    console.log(`[S3Upload] Got ${uploads.length} presigned URLs, ${skipped.length} skipped`)

    // Create a map for quick lookup
    const fileMap = new Map(files.map(f => [f.fileHash, f]))

    // 2. Upload files to S3 in parallel batches
    const uploaded: string[] = []
    const failed: Array<{ fileHash: string; error: string }> = []
    let completedCount = 0

    // Process in batches of UPLOAD_CONCURRENCY
    for (let i = 0; i < uploads.length; i += UPLOAD_CONCURRENCY) {
      const batch = uploads.slice(i, i + UPLOAD_CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map(async (upload) => {
          const file = fileMap.get(upload.fileHash)
          if (!file) {
            throw new Error(`File not found for hash: ${upload.fileHash}`)
          }

          await this.uploadToS3(upload.uploadUrl, file.filePath)
          return upload.fileHash
        })
      )

      // Process results
      for (let j = 0; j < results.length; j++) {
        const result = results[j]
        const upload = batch[j]

        if (result.status === 'fulfilled') {
          uploaded.push(result.value)
        } else {
          const errorMessage = result.reason?.message || 'Upload failed'
          console.error(`[S3Upload] Failed to upload ${upload.fileHash}: ${errorMessage}`)
          failed.push({
            fileHash: upload.fileHash,
            error: errorMessage,
          })
        }

        completedCount++
        onProgress(completedCount, uploads.length)
      }
    }

    console.log(`[S3Upload] Uploaded ${uploaded.length} files, ${failed.length} failed`)

    // 3. Confirm uploads with backend
    if (uploaded.length > 0 || failed.length > 0) {
      console.log(`[S3Upload] Confirming uploads with backend`)
      await this.apiClient.confirmUploads(integrationId, {
        syncRunId,
        uploadedFiles: uploaded,
        failedFiles: failed.length > 0 ? failed : undefined,
      })
    }

    return {
      syncRunId,
      uploaded,
      failed,
      skipped: skipped.map(s => s.fileHash),
    }
  }

  /**
   * Upload a single file to S3 using presigned URL
   */
  private async uploadToS3(presignedUrl: string, filePath: string): Promise<void> {
    const fileBuffer = fs.readFileSync(filePath)

    // Use axios for reliable uploads in Electron environment
    const response = await axios.put(presignedUrl, fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Show confirmation dialog for large uploads
   */
  private async showLargeUploadConfirmation(
    fileCount: number,
    totalBytes: number
  ): Promise<boolean> {
    const sizeMB = (totalBytes / 1024 / 1024).toFixed(1)

    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Continuar', 'Cancelar'],
      defaultId: 0,
      title: 'Confirmación de sincronización',
      message: `Estás por sincronizar ${fileCount.toLocaleString()} archivos (${sizeMB} MB)`,
      detail: 'Esta operación puede tomar varios minutos. ¿Deseas continuar?',
    })

    return result.response === 0
  }

  /**
   * Poll sync status until complete
   */
  async pollSyncStatus(
    integrationId: string,
    syncRunId: string,
    onUpdate: (status: S3SyncStatus) => void,
    intervalMs: number = 5000
  ): Promise<S3SyncStatus> {
    return new Promise((resolve) => {
      const poll = async () => {
        try {
          const status = await this.apiClient.getSyncStatus(integrationId, syncRunId)
          onUpdate(status)

          if (status.isComplete) {
            resolve(status)
          } else {
            setTimeout(poll, intervalMs)
          }
        } catch (error) {
          console.error('[S3Upload] Error polling status:', error)
          // Continue polling on error
          setTimeout(poll, intervalMs)
        }
      }

      poll()
    })
  }

  /**
   * Resume an interrupted sync
   */
  async resumeSync(
    integrationId: string,
    syncRunId: string
  ): Promise<ResumeSyncResponse | null> {
    try {
      const response = await this.apiClient.resumeSync(integrationId, syncRunId)
      return response
    } catch (error) {
      console.error('[S3Upload] Failed to resume sync:', error)
      return null
    }
  }

  /**
   * Check for incomplete syncs
   */
  async checkForIncompleteSyncs(
    integrationId: string
  ): Promise<{ id: string; status: string; filesCompleted: number; filesPending: number } | null> {
    try {
      const incompleteSyncs = await this.apiClient.getIncompleteSyncs(integrationId)

      if (incompleteSyncs.length > 0) {
        const lastSync = incompleteSyncs[0]
        return {
          id: lastSync.id,
          status: lastSync.status,
          filesCompleted: lastSync.filesCompleted,
          filesPending: lastSync.filesPendingUpload + lastSync.filesUploadedToS3,
        }
      }

      return null
    } catch (error) {
      console.error('[S3Upload] Error checking for incomplete syncs:', error)
      return null
    }
  }

  /**
   * Show dialog to ask user if they want to resume an incomplete sync
   */
  async promptResumeSync(
    filesCompleted: number,
    filesPending: number
  ): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Continuar sync anterior', 'Iniciar nuevo sync'],
      defaultId: 0,
      title: 'Sincronización incompleta detectada',
      message: 'Se encontró una sincronización incompleta',
      detail: `${filesCompleted} archivos ya procesados, ${filesPending} pendientes. ¿Deseas continuar?`,
    })

    return result.response === 0
  }
}
