/**
 * Shared types between main and renderer processes
 */
export interface AppConfig {
    apiUrl: string;
    apiToken: string;
    integrationId: string;
    companyId: string;
}
export interface FolderConfig {
    id: number;
    localPath: string;
    includeSubfolders: boolean;
    fileExtensions: string[] | null;
    maxFileSizeMb: number | null;
    groupIds: string[];
    ignoreHidden: boolean;
    enabled: boolean;
}
export interface FileRecord {
    id: number;
    filePath: string;
    fileHash: string;
    fileSize: number;
    lastModified: number;
    documentId: string | null;
    folderConfigId: number;
    lastSyncedAt: number | null;
    status: 'pending' | 'synced' | 'failed' | 'deleted';
    errorMessage: string | null;
}
export interface SyncStatus {
    isRunning: boolean;
    currentSyncRunId: string | null;
    lastSyncAt: number | null;
    filesScanned: number;
    filesNew: number;
    filesUpdated: number;
    filesDeleted: number;
    filesFailed: number;
    bytesProcessed: number;
    progress: number;
}
export interface SyncRun {
    id: string;
    integrationId: string;
    status: 'running' | 'completed' | 'failed' | 'partial';
    triggeredBy: string;
    startedAt: string;
    completedAt: string | null;
    filesScanned: number;
    filesNew: number;
    filesUpdated: number;
    filesDeleted: number;
    filesFailed: number;
    bytesProcessed: number;
    errorMessage: string | null;
}
export interface Group {
    id: string;
    name: string;
    isSystem: boolean;
}
export interface ScheduleConfig {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly' | 'manual';
    time?: string;
    dayOfWeek?: number;
    cronExpression?: string;
}
export interface UpdateStatus {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    percent?: number;
    error?: string;
}
