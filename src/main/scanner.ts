/**
 * File Scanner
 * Scans folders and computes SHA-256 hashes
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { FolderConfig } from '../shared/types'

export interface ScannedFile {
  filePath: string
  fileHash: string
  fileSize: number
  lastModified: number
  folderConfigId: number
}

export class FileScanner {
  /**
   * Scan a folder configuration and return all matching files
   */
  async scanFolder(config: FolderConfig): Promise<ScannedFile[]> {
    const files: ScannedFile[] = []
    await this.scanDirectory(config.localPath, config, files)
    return files
  }

  private async scanDirectory(
    dirPath: string,
    config: FolderConfig,
    files: ScannedFile[]
  ): Promise<void> {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        // Skip hidden files if configured
        if (config.ignoreHidden && entry.name.startsWith('.')) {
          continue
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectories if enabled
          if (config.includeSubfolders) {
            await this.scanDirectory(fullPath, config, files)
          }
        } else if (entry.isFile()) {
          // Check file extension filter
          if (config.fileExtensions && config.fileExtensions.length > 0) {
            const ext = path.extname(entry.name).toLowerCase()
            if (!config.fileExtensions.includes(ext)) {
              continue
            }
          }

          // Check file size limit
          const stats = fs.statSync(fullPath)
          if (config.maxFileSizeMb) {
            const fileSizeMb = stats.size / (1024 * 1024)
            if (fileSizeMb > config.maxFileSizeMb) {
              continue
            }
          }

          // Compute hash and add to results
          const fileHash = await this.computeFileHash(fullPath)
          files.push({
            filePath: fullPath,
            fileHash,
            fileSize: stats.size,
            lastModified: Math.floor(stats.mtimeMs),
            folderConfigId: config.id,
          })
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error)
    }
  }

  /**
   * Compute SHA-256 hash of a file
   */
  async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)

      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  /**
   * Check if file exists and get its stats
   */
  fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath)
    } catch {
      return false
    }
  }

  /**
   * Get file modification time
   */
  getFileModTime(filePath: string): number {
    try {
      const stats = fs.statSync(filePath)
      return Math.floor(stats.mtimeMs)
    } catch {
      return 0
    }
  }
}
