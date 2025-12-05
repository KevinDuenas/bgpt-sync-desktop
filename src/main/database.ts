/**
 * Simple JSON File Storage (replacing SQLite for now)
 */
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { FolderConfig, FileRecord } from '../shared/types'

interface DatabaseData {
  config: Record<string, string>
  folderConfigs: FolderConfig[]
  files: FileRecord[]
}

export class DatabaseManager {
  private dbPath: string
  private data: DatabaseData

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'sync-data.json')
    this.data = this.loadData()
  }

  private loadData(): DatabaseData {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error('Error loading database:', error)
    }

    return {
      config: {},
      folderConfigs: [],
      files: [],
    }
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Error saving database:', error)
    }
  }

  // Config methods
  getConfig(key: string): string | null {
    return this.data.config[key] || null
  }

  setConfig(key: string, value: string): void {
    this.data.config[key] = value
    this.saveData()
  }

  deleteConfig(key: string): void {
    delete this.data.config[key]
    this.saveData()
  }

  // Folder config methods
  getFolderConfigs(): FolderConfig[] {
    return this.data.folderConfigs
  }

  addFolderConfig(config: Omit<FolderConfig, 'id'>): number {
    const id = this.data.folderConfigs.length > 0
      ? Math.max(...this.data.folderConfigs.map(f => f.id)) + 1
      : 1

    this.data.folderConfigs.push({ ...config, id })
    this.saveData()
    return id
  }

  updateFolderConfig(id: number, config: Partial<Omit<FolderConfig, 'id'>>): void {
    const index = this.data.folderConfigs.findIndex(f => f.id === id)
    if (index !== -1) {
      this.data.folderConfigs[index] = { ...this.data.folderConfigs[index], ...config }
      this.saveData()
    }
  }

  deleteFolderConfig(id: number): void {
    this.data.folderConfigs = this.data.folderConfigs.filter(f => f.id !== id)
    this.data.files = this.data.files.filter(f => f.folderConfigId !== id)
    this.saveData()
  }

  // File tracking methods
  getFileByPath(filePath: string): FileRecord | null {
    return this.data.files.find(f => f.filePath === filePath) || null
  }

  getFilesByStatus(status: string): FileRecord[] {
    return this.data.files.filter(f => f.status === status)
  }

  getFilesByFolderConfig(folderConfigId: number): FileRecord[] {
    return this.data.files.filter(f => f.folderConfigId === folderConfigId)
  }

  upsertFile(file: Omit<FileRecord, 'id'>): void {
    const index = this.data.files.findIndex(f => f.filePath === file.filePath)

    if (index !== -1) {
      this.data.files[index] = { ...this.data.files[index], ...file }
    } else {
      const id = this.data.files.length > 0
        ? Math.max(...this.data.files.map(f => f.id)) + 1
        : 1
      this.data.files.push({ ...file, id })
    }

    this.saveData()
  }

  updateFileStatus(filePath: string, status: string, errorMessage?: string): void {
    const index = this.data.files.findIndex(f => f.filePath === filePath)
    if (index !== -1) {
      this.data.files[index].status = status as 'pending' | 'synced' | 'failed' | 'deleted'
      this.data.files[index].errorMessage = errorMessage || null
      this.saveData()
    }
  }

  deleteFilesByPaths(filePaths: string[]): void {
    this.data.files = this.data.files.filter(f => !filePaths.includes(f.filePath))
    this.saveData()
  }

  close(): void {
    this.saveData()
  }
}
