/**
 * History Page Component
 */
import React, { useState, useEffect } from 'react'
import { History, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { SyncRun } from '@shared/types'

export default function HistoryPage() {
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([])
  const [loading, setLoading] = useState(true)

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
            <SyncRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SyncRunCardProps {
  run: SyncRun
}

function SyncRunCard({ run }: SyncRunCardProps) {
  const statusConfig = {
    completed: { icon: <CheckCircle size={24} />, color: '#10b981', bg: '#d1fae5', text: 'Completado' },
    failed: { icon: <XCircle size={24} />, color: '#ef4444', bg: '#fee2e2', text: 'Fallido' },
    partial: { icon: <AlertCircle size={24} />, color: '#f59e0b', bg: '#fef3c7', text: 'Parcial' },
    running: { icon: <RefreshCw size={24} />, color: '#3b82f6', bg: '#dbeafe', text: 'Ejecutando' },
  }

  const config = statusConfig[run.status as keyof typeof statusConfig] || statusConfig.completed

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatItem label="Escaneados" value={run.filesScanned} />
        <StatItem label="Nuevos" value={run.filesNew} color="#10b981" />
        <StatItem label="Actualizados" value={run.filesUpdated} color="#3b82f6" />
        <StatItem label="Sin Cambios" value={run.filesSkipped} color="#6b7280" />
        <StatItem label="Eliminados" value={run.filesDeleted} color="#f59e0b" />
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
  const date = new Date(dateString)
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: string, end: string): string {
  const duration = new Date(end).getTime() - new Date(start).getTime()
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
