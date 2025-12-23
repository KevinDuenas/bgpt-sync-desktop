/**
 * History Page Component
 */
import React, { useState, useEffect } from 'react'
import { History, CheckCircle, XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { SyncRun, SyncFileDetail, SyncFilesResponse } from '../../shared/types'

// Error code labels in Spanish
const ERROR_CODE_LABELS: Record<string, { label: string; color: string }> = {
  unsupported_file_type: { label: 'Tipo no soportado', color: '#6b7280' },
  password_protected: { label: 'Protegido con contraseña', color: '#f59e0b' },
  rate_limited: { label: 'Límite excedido', color: '#8b5cf6' },
  file_too_large: { label: 'Archivo muy grande', color: '#ef4444' },
  processing_failed: { label: 'Error de procesamiento', color: '#ef4444' },
  invalid_file: { label: 'Archivo inválido', color: '#ef4444' },
  connection_error: { label: 'Error de conexión', color: '#f59e0b' },
  s3_error: { label: 'Error de S3', color: '#ef4444' },
  database_error: { label: 'Error de BD', color: '#ef4444' },
  pinecone_error: { label: 'Error de Pinecone', color: '#ef4444' },
  unknown: { label: 'Error desconocido', color: '#6b7280' },
}

export default function HistoryPage() {
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.getSyncHistory(50)
      setSyncRuns(data.syncRuns)
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleExpand = (runId: string) => {
    setExpandedRunId(expandedRunId === runId ? null : runId)
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <History size={32} />
          <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Historial de Sincronización</h1>
        </div>
        <button
          onClick={loadHistory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '60px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>Cargando historial...</p>
        </div>
      ) : syncRuns.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '60px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <History size={64} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Sin historial de sincronización</h3>
          <p style={{ color: '#6b7280' }}>Ejecuta tu primera sincronización para ver el historial aquí</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {syncRuns.map((run) => (
            <SyncRunCard
              key={run.id}
              run={run}
              isExpanded={expandedRunId === run.id}
              onToggle={() => handleToggleExpand(run.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SyncRunCardProps {
  run: SyncRun
  isExpanded: boolean
  onToggle: () => void
}

function SyncRunCard({ run, isExpanded, onToggle }: SyncRunCardProps) {
  const [files, setFiles] = useState<SyncFileDetail[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [byErrorCode, setByErrorCode] = useState<Record<string, number>>({})
  const [byStatus, setByStatus] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const statusConfig = {
    completed: { icon: <CheckCircle size={24} />, color: '#10b981', bg: '#d1fae5', text: 'Completado' },
    failed: { icon: <XCircle size={24} />, color: '#ef4444', bg: '#fee2e2', text: 'Fallido' },
    partial: { icon: <AlertCircle size={24} />, color: '#f59e0b', bg: '#fef3c7', text: 'Parcial' },
    running: { icon: <RefreshCw size={24} />, color: '#3b82f6', bg: '#dbeafe', text: 'Ejecutando' },
  }

  const config = statusConfig[run.status as keyof typeof statusConfig] || statusConfig.completed

  useEffect(() => {
    if (isExpanded) {
      loadFiles()
    }
  }, [isExpanded, statusFilter])

  const loadFiles = async () => {
    setFilesLoading(true)
    try {
      const options: { status?: string; limit?: number } = { limit: 100 }
      if (statusFilter) options.status = statusFilter

      const data: SyncFilesResponse = await window.electronAPI.getSyncFiles(run.id, options)
      setFiles(data.files)
      setByErrorCode(data.byErrorCode)
      setByStatus(data.byStatus)
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      setFilesLoading(false)
    }
  }

  // Allow expansion for any completed/partial/failed sync (not just failed)
  const canExpand = ['completed', 'partial', 'failed'].includes(run.status)

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
    }}>
      {/* Header - clickable */}
      <div
        onClick={canExpand ? onToggle : undefined}
        style={{
          padding: '24px',
          cursor: canExpand ? 'pointer' : 'default',
          borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ color: config.color }}>{config.icon}</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>
                  Sincronización
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  {formatDate(run.startedAt)}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '6px 12px',
              backgroundColor: config.bg,
              color: config.color,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
            }}>
              {config.text}
            </div>
            {canExpand && (
              isExpanded ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <StatItem label="Escaneados" value={run.filesScanned} />
          <StatItem label="Nuevos" value={run.filesNew} color="#3b82f6" />
          <StatItem label="Actualizados" value={run.filesUpdated} color="#3b82f6" />
          <StatItem label="Sin Cambios" value={run.filesSkipped} color="#6b7280" />
          <StatItem label="Eliminados" value={run.filesDeleted} color="#f59e0b" />
          <StatItem label="Procesados" value={run.filesCompleted} color="#10b981" />
          <StatItem label="Fallidos" value={run.filesFailed} color="#ef4444" />
          <StatItem label="Datos" value={formatBytes(run.bytesProcessed)} />
        </div>

        {run.errorMessage && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '6px',
            fontSize: '13px',
          }}>
            <strong>Error:</strong> {run.errorMessage}
          </div>
        )}

        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#6b7280',
        }}>
          <span>Iniciado por: {run.triggeredBy}</span>
          {run.completedAt && (
            <span>Duración: {formatDuration(run.startedAt, run.completedAt)}</span>
          )}
        </div>
      </div>

      {/* Expanded file details */}
      {isExpanded && (
        <div style={{ padding: '24px', backgroundColor: '#f9fafb' }}>
          {/* Processing results summary - shows actual Lambda processing results */}
          {Object.keys(byStatus).length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}>
              <h4 style={{
                gridColumn: '1 / -1',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#374151'
              }}>
                Resultado del Procesamiento
              </h4>
              {byStatus.completed !== undefined && (
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Completados</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{byStatus.completed || 0}</p>
                </div>
              )}
              {byStatus.failed !== undefined && (
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Fallidos</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>{byStatus.failed || 0}</p>
                </div>
              )}
              {byStatus.processing !== undefined && byStatus.processing > 0 && (
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Procesando</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{byStatus.processing}</p>
                </div>
              )}
              {byStatus.pending !== undefined && byStatus.pending > 0 && (
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Pendientes</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{byStatus.pending}</p>
                </div>
              )}
            </div>
          )}

          {/* Error code summary */}
          {Object.keys(byErrorCode).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                Resumen de Errores
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(byErrorCode).map(([code, count]) => {
                  const errorInfo = ERROR_CODE_LABELS[code] || { label: code, color: '#6b7280' }
                  return (
                    <button
                      key={code}
                      onClick={(e) => {
                        e.stopPropagation()
                        setStatusFilter(statusFilter === 'failed' ? null : 'failed')
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: errorInfo.color,
                      }} />
                      <span style={{ color: '#374151' }}>{errorInfo.label}</span>
                      <span style={{
                        backgroundColor: '#f3f4f6',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6b7280',
                      }}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <FilterTab
              label="Todos"
              active={statusFilter === null}
              onClick={() => setStatusFilter(null)}
            />
            <FilterTab
              label="Completados"
              active={statusFilter === 'completed'}
              onClick={() => setStatusFilter('completed')}
              color="#10b981"
            />
            <FilterTab
              label="Fallidos"
              active={statusFilter === 'failed'}
              onClick={() => setStatusFilter('failed')}
              color="#ef4444"
            />
          </div>

          {/* File list */}
          {filesLoading ? (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Cargando archivos...</p>
          ) : files.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No hay archivos para mostrar</p>
          ) : (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              maxHeight: '400px',
              overflowY: 'auto',
            }}>
              {files.map((file, idx) => (
                <FileRow key={file.id} file={file} isLast={idx === files.length - 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface FilterTabProps {
  label: string
  active: boolean
  onClick: () => void
  color?: string
}

function FilterTab({ label, active, onClick, color }: FilterTabProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        padding: '6px 12px',
        backgroundColor: active ? (color || '#3b82f6') : 'white',
        color: active ? 'white' : '#6b7280',
        border: `1px solid ${active ? (color || '#3b82f6') : '#e5e7eb'}`,
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

interface FileRowProps {
  file: SyncFileDetail
  isLast: boolean
}

function FileRow({ file, isLast }: FileRowProps) {
  const isFailed = file.status === 'failed'
  const errorInfo = file.errorCode ? ERROR_CODE_LABELS[file.errorCode] : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
      gap: '12px',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        backgroundColor: isFailed ? '#fef2f2' : '#f0fdf4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isFailed ? (
          <XCircle size={16} color="#ef4444" />
        ) : (
          <CheckCircle size={16} color="#10b981" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '14px',
          fontWeight: '500',
          color: '#111827',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {file.fileName}
        </p>
        {isFailed && file.lastError && (
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {file.lastError}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {file.fileSize > 0 && (
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            {formatBytes(file.fileSize)}
          </span>
        )}
        {errorInfo && (
          <span style={{
            padding: '4px 8px',
            backgroundColor: `${errorInfo.color}15`,
            color: errorInfo.color,
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {errorInfo.label}
          </span>
        )}
      </div>
    </div>
  )
}

interface StatItemProps {
  label: string
  value: number | string
  color?: string
}

function StatItem({ label, value, color = '#111827' }: StatItemProps) {
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '18px', fontWeight: 'bold', color }}>{value}</p>
    </div>
  )
}

function formatDate(dateString: string): string {
  // Backend sends UTC times without 'Z' suffix, so we need to treat them as UTC
  // by appending 'Z' if not already present
  const utcDateString = dateString.endsWith('Z') ? dateString : dateString + 'Z'
  const date = new Date(utcDateString)
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: string, end: string): string {
  // Ensure both dates are treated as UTC
  const startUtc = start.endsWith('Z') ? start : start + 'Z'
  const endUtc = end.endsWith('Z') ? end : end + 'Z'
  const duration = new Date(endUtc).getTime() - new Date(startUtc).getTime()
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
