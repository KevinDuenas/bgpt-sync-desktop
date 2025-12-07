/**
 * API Client for Backend Communication
 */
import axios, { AxiosInstance } from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import { Readable } from 'stream'
import { SyncRun, Group } from '../shared/types'

// Fixed backend URL - not configurable
const API_BASE_URL = 'https://api.mypetid.app'

export class ApiClient {
  private client: AxiosInstance

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
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
    const response = await this.client.get('/integrations/custom/me')
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
    const response = await this.client.post(`/integrations/custom/${integrationId}/check-hash`, {
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
      `/integrations/custom/${integrationId}/upload-batch`,
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
    const response = await this.client.delete(`/integrations/custom/${integrationId}/documents`, {
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
    const response = await this.client.post(`/integrations/custom/${integrationId}/sync-runs`, {
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
      `/integrations/custom/${integrationId}/sync-runs/${syncRunId}`,
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
    }
  ): Promise<SyncRun> {
    const response = await this.client.post(
      `/integrations/custom/${integrationId}/sync-runs/${syncRunId}/complete`,
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
      }
    )
    return response.data
  }

  /**
   * Get available groups for permission assignment
   */
  async getGroups(integrationId: string): Promise<Group[]> {
    const response = await this.client.get(`/integrations/custom/${integrationId}/groups`)
    return response.data.groups
  }

  /**
   * Get sync runs history
   */
  async getSyncRuns(integrationId: string, limit: number = 50): Promise<{ syncRuns: SyncRun[]; total: number }> {
    const response = await this.client.get(`/integrations/custom/${integrationId}/sync-runs`, {
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
      bytesProcessed: run.bytes_processed as number || 0,
      errorMessage: run.error_message as string | null,
    }))
    return {
      syncRuns,
      total: response.data.total,
    }
  }
}
