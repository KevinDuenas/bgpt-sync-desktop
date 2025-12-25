/**
 * API Client for Backend Communication
 */
import axios, { AxiosInstance } from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import { Readable } from 'stream'
import { SyncRun, Group, SyncFilesResponse, SyncFileDetail } from '../shared/types'

// Fixed backend URL - not configurable
const API_BASE_URL = 'https://api.oyelina.com'

export class ApiClient {
  private client: AxiosInstance

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
      timeout: 5 * 60 * 1000, // 5 minutes timeout for large uploads
    })
  }

  /**
   * Get integration info for the authenticated token
   * Creates integration if it doesn't exist
   */
  async getMyIntegration(): Promise<{
    integrationId: string
    companyId: string
    companyName: string
    displayName: string
    created: boolean
  }> {
    const response = await this.client.get('/integrations/local/me')
    return {
      integrationId: response.data.integration_id,
      companyId: response.data.company_id,
      companyName: response.data.company_name,
      displayName: response.data.display_name,
      created: response.data.created,
    }
  }

  /**
   * Check which file hashes already exist in the backend
   */
  async checkHashes(integrationId: string, fileHashes: string[]): Promise<Map<string, { exists: boolean; documentId?: string }>> {
    const response = await this.client.post(`/integrations/local/${integrationId}/check-hash`, {
      file_hashes: fileHashes,
    })

    const results = new Map<string, { exists: boolean; documentId?: string }>()
    for (const result of response.data.results) {
      results.set(result.file_hash, {
        exists: result.exists,
        documentId: result.document_id,
      })
    }
    return results
  }

  /**
   * Upload files in batch
   * Supports both regular files and converted files (e.g., XML converted to JSON)
   */
  async uploadBatch(
    integrationId: string,
    files: Array<{
      filePath: string
      fileHash: string
      fileName: string
      fileSize: number
      folderConfigId: number
      groupIds: string[]
      localPath: string
      // For converted files (e.g., XML -> JSON)
      convertedContent?: Buffer
      originalFileName?: string
      convertedFrom?: string
    }>,
    machineId: string,
    os: string
  ): Promise<Array<{ fileHash: string; documentId?: string; status: string; errorMessage?: string }>> {
    const formData = new FormData()

    // Add metadata
    const metadata = {
      files: files.map(f => ({
        file_hash: f.fileHash,
        file_name: f.fileName,
        file_size: f.convertedContent ? f.convertedContent.length : f.fileSize,
        local_path: f.localPath,
        folder_config_id: f.folderConfigId,
        group_ids: f.groupIds,
        extra_metadata: {
          // Include original file info if this was converted
          ...(f.originalFileName && { original_filename: f.originalFileName }),
          ...(f.convertedFrom && { converted_from: f.convertedFrom }),
        },
      })),
      machine_id: machineId,
      os: os,
    }
    formData.append('metadata', JSON.stringify(metadata))

    // Add file data - use converted content if available, otherwise read from disk
    for (const file of files) {
      if (file.convertedContent) {
        // Use Buffer stream for converted files
        const stream = Readable.from(file.convertedContent)
        formData.append('files', stream, {
          filename: file.fileName,
          contentType: 'application/json',
        })
      } else {
        formData.append('files', fs.createReadStream(file.filePath), {
          filename: file.fileName,
        })
      }
    }

    const response = await this.client.post(
      `/integrations/local/${integrationId}/upload-batch`,
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    )

    return response.data.results.map((r: any) => ({
      fileHash: r.file_hash,
      documentId: r.document_id,
      status: r.status,
      errorMessage: r.error_message,
    }))
  }

  /**
   * Delete documents by hash
   */
  async deleteBatch(integrationId: string, fileHashes: string[]): Promise<{ deletedCount: number; errors: string[] }> {
    const response = await this.client.delete(`/integrations/local/${integrationId}/documents`, {
      data: {
        file_hashes: fileHashes,
      },
    })
    return {
      deletedCount: response.data.deleted_count,
      errors: response.data.errors || [],
    }
  }

  /**
   * Create a new sync run
   */
  async createSyncRun(integrationId: string, triggeredBy: string = 'desktop_app'): Promise<SyncRun> {
    const response = await this.client.post(`/integrations/local/${integrationId}/sync-runs`, {
      triggered_by: triggeredBy,
    })
    return response.data
  }

  /**
   * Update sync run progress
   */
  async updateSyncRun(
    integrationId: string,
    syncRunId: string,
    progress: {
      filesScanned?: number
      filesNew?: number
      filesUpdated?: number
      filesDeleted?: number
      filesFailed?: number
      filesSkipped?: number
      bytesProcessed?: number
    }
  ): Promise<SyncRun> {
    const response = await this.client.patch(
      `/integrations/local/${integrationId}/sync-runs/${syncRunId}`,
      {
        files_scanned: progress.filesScanned,
        files_new: progress.filesNew,
        files_updated: progress.filesUpdated,
        files_deleted: progress.filesDeleted,
        files_failed: progress.filesFailed,
        files_skipped: progress.filesSkipped,
        bytes_processed: progress.bytesProcessed,
      }
    )
    return response.data
  }

  /**
   * Complete a sync run
   */
  async completeSyncRun(
    integrationId: string,
    syncRunId: string,
    status: 'completed' | 'failed' | 'partial',
    stats: {
      filesScanned: number
      filesNew: number
      filesUpdated: number
      filesDeleted: number
      filesFailed: number
      filesSkipped: number
      bytesProcessed: number
      errorMessage?: string
      errorDetails?: Array<{ fileName: string; filePath: string; error: string }>
    }
  ): Promise<SyncRun> {
    const response = await this.client.post(
      `/integrations/local/${integrationId}/sync-runs/${syncRunId}/complete`,
      {
        status,
        error_message: stats.errorMessage,
        files_scanned: stats.filesScanned,
        files_new: stats.filesNew,
        files_updated: stats.filesUpdated,
        files_deleted: stats.filesDeleted,
        files_failed: stats.filesFailed,
        files_skipped: stats.filesSkipped,
        bytes_processed: stats.bytesProcessed,
        error_details: stats.errorDetails && stats.errorDetails.length > 0 ? {
          failed_files: stats.errorDetails.map(e => ({
            file_name: e.fileName,
            file_path: e.filePath,
            error: e.error,
          })),
        } : undefined,
      }
    )
    return response.data
  }

  /**
   * Get available groups for permission assignment
   */
  async getGroups(integrationId: string): Promise<Group[]> {
    const response = await this.client.get(`/integrations/local/${integrationId}/groups`)
    return response.data.groups
  }

  /**
   * Get sync runs history
   */
  async getSyncRuns(integrationId: string, limit: number = 50): Promise<{ syncRuns: SyncRun[]; total: number }> {
    const response = await this.client.get(`/integrations/local/${integrationId}/sync-runs`, {
      params: { limit },
    })
    // Map snake_case from API to camelCase for frontend
    const syncRuns: SyncRun[] = (response.data.sync_runs || []).map((run: Record<string, unknown>) => ({
      id: run.id as string,
      integrationId: run.integration_id as string,
      status: run.status as SyncRun['status'],
      triggeredBy: run.triggered_by as string,
      startedAt: run.started_at as string,
      completedAt: run.completed_at as string | null,
      filesScanned: run.files_scanned as number || 0,
      filesNew: run.files_new as number || 0,
      filesUpdated: run.files_updated as number || 0,
      filesDeleted: run.files_deleted as number || 0,
      filesFailed: run.files_failed as number || 0,
      filesSkipped: run.files_skipped as number || 0,
      filesCompleted: run.files_completed as number || 0,
      bytesProcessed: run.bytes_processed as number || 0,
      errorMessage: run.error_message as string | null,
    }))
    return {
      syncRuns,
      total: response.data.total,
    }
  }

  /**
   * Get sync files for a specific sync run
   */
  async getSyncFiles(
    integrationId: string,
    syncRunId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<SyncFilesResponse> {
    const response = await this.client.get(
      `/integrations/local/${integrationId}/sync-runs/${syncRunId}/files`,
      { params: options }
    )

    // Map snake_case from API to camelCase for frontend
    const files: SyncFileDetail[] = (response.data.files || []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      fileName: f.file_name as string,
      fileHash: f.file_hash as string,
      fileSize: f.file_size as number,
      status: f.status as string,
      errorCode: f.error_code as string | null,
      lastError: f.last_error as string | null,
      retryCount: f.retry_count as number || 0,
      createdAt: f.created_at as string,
      updatedAt: f.updated_at as string | null,
      processedAt: f.processed_at as string | null,
    }))

    return {
      files,
      total: response.data.total,
      byStatus: response.data.by_status || {},
      byErrorCode: response.data.by_error_code || {},
    }
  }

  // ==========================================================================
  // S3 Upload Methods (New async upload flow)
  // ==========================================================================

  /**
   * Request presigned URLs for S3 upload
   */
  async requestBatchUpload(
    integrationId: string,
    files: Array<{
      fileHash: string
      fileName: string
      fileSize: number
      folderConfigId?: number
      groupIds: string[]
      localPath?: string
    }>,
    machineId: string,
    os: string,
    syncRunId?: string
  ): Promise<S3BatchUploadResponse> {
    const response = await this.client.post(
      `/integrations/local/${integrationId}/request-batch-upload`,
      {
        files: files.map(f => ({
          file_hash: f.fileHash,
          file_name: f.fileName,
          file_size: f.fileSize,
          folder_config_id: f.folderConfigId,
          group_ids: f.groupIds,
          local_path: f.localPath,
        })),
        machine_id: machineId,
        os: os,
        sync_run_id: syncRunId,
      }
    )

    return {
      syncRunId: response.data.sync_run_id,
      uploads: response.data.uploads.map((u: any) => ({
        fileHash: u.file_hash,
        uploadUrl: u.upload_url,
        s3Key: u.s3_key,
      })),
      skipped: response.data.skipped.map((s: any) => ({
        fileHash: s.file_hash,
        reason: s.reason,
        documentId: s.document_id,
      })),
      totalSizeBytes: response.data.total_size_bytes,
      requiresConfirmation: response.data.requires_confirmation,
    }
  }

  /**
   * Confirm which files were uploaded to S3
   */
  async confirmUploads(
    integrationId: string,
    data: {
      syncRunId: string
      uploadedFiles: string[]
      failedFiles?: Array<{ fileHash: string; error: string }>
    }
  ): Promise<{ status: string; messagesQueued: number; filesProcessing: number }> {
    const response = await this.client.post(
      `/integrations/local/${integrationId}/confirm-uploads`,
      {
        sync_run_id: data.syncRunId,
        uploaded_files: data.uploadedFiles,
        failed_files: data.failedFiles?.map(f => ({
          file_hash: f.fileHash,
          error: f.error,
        })),
      }
    )

    return {
      status: response.data.status,
      messagesQueued: response.data.messages_queued,
      filesProcessing: response.data.files_processing,
    }
  }

  /**
   * Get S3 sync status for polling
   */
  async getSyncStatus(integrationId: string, syncRunId: string): Promise<S3SyncStatus> {
    const response = await this.client.get(
      `/integrations/local/${integrationId}/sync-runs/${syncRunId}/status`
    )

    return {
      syncRunId: response.data.sync_run_id,
      status: response.data.status,
      uploadMethod: response.data.upload_method,
      filesPendingUpload: response.data.files_pending_upload,
      filesUploadedToS3: response.data.files_uploaded_to_s3,
      filesProcessing: response.data.files_processing,
      filesCompleted: response.data.files_completed,
      filesFailed: response.data.files_failed,
      filesSkipped: response.data.files_skipped,
      progressPercent: response.data.progress_percent,
      errors: response.data.errors,
      isComplete: response.data.is_complete,
      isResumable: response.data.is_resumable,
    }
  }

  /**
   * Resume an interrupted sync
   */
  async resumeSync(integrationId: string, syncRunId: string): Promise<ResumeSyncResponse> {
    const response = await this.client.post(
      `/integrations/local/${integrationId}/sync-runs/${syncRunId}/resume`
    )

    return {
      syncRunId: response.data.sync_run_id,
      uploads: response.data.uploads.map((u: any) => ({
        fileHash: u.file_hash,
        uploadUrl: u.upload_url,
        s3Key: u.s3_key,
      })),
      filesAlreadyUploaded: response.data.files_already_uploaded,
      filesCompleted: response.data.files_completed,
      canResume: response.data.can_resume,
    }
  }

  /**
   * Get incomplete/resumable syncs
   */
  async getIncompleteSyncs(integrationId: string): Promise<IncompleteSyncInfo[]> {
    const response = await this.client.get(
      `/integrations/local/${integrationId}/incomplete-syncs`
    )

    return response.data.incomplete_syncs.map((s: any) => ({
      id: s.id,
      status: s.status,
      uploadMethod: s.upload_method,
      filesPendingUpload: s.files_pending_upload,
      filesUploadedToS3: s.files_uploaded_to_s3,
      filesCompleted: s.files_completed,
      createdAt: s.created_at,
      lastActivityAt: s.last_activity_at,
    }))
  }
}

// Types for S3 upload flow
export interface S3BatchUploadResponse {
  syncRunId: string
  uploads: Array<{
    fileHash: string
    uploadUrl: string
    s3Key: string
  }>
  skipped: Array<{
    fileHash: string
    reason: string
    documentId?: string
  }>
  totalSizeBytes: number
  requiresConfirmation: boolean
}

export interface S3SyncStatus {
  syncRunId: string
  status: string
  uploadMethod: string
  filesPendingUpload: number
  filesUploadedToS3: number
  filesProcessing: number
  filesCompleted: number
  filesFailed: number
  filesSkipped: number
  progressPercent: number
  errors: Array<{ fileName: string; error: string }>
  isComplete: boolean
  isResumable: boolean
}

export interface ResumeSyncResponse {
  syncRunId: string
  uploads: Array<{
    fileHash: string
    uploadUrl: string
    s3Key: string
  }>
  filesAlreadyUploaded: number
  filesCompleted: number
  canResume: boolean
}

export interface IncompleteSyncInfo {
  id: string
  status: string
  uploadMethod: string
  filesPendingUpload: number
  filesUploadedToS3: number
  filesCompleted: number
  createdAt: string
  lastActivityAt: string
}
