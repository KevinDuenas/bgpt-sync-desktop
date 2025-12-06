/**
 * Dashboard Component
 */
import React, { useState, useEffect } from 'react'
import { PlayCircle, CheckCircle, XCircle, Clock, FolderOpen, AlertCircle, MinusCircle } from 'lucide-react'
import { SyncStatus } from '@shared/types'

export default function Dashboard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [stats, setStats] = useState({ totalFiles: 0, failedFiles: 0, lastSyncAt: null as number | null })
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    loadStatus()
    loadStats()

    // Listen for sync status updates
    window.electronAPI.onSyncStatusUpdate((status) => {
      setSyncStatus(status)
      if (!status.isRunning) {
        loadStats()
      }
    })

    return () => {
      window.electronAPI.offSyncStatusUpdate()
    }
  }, [])

  const loadStatus = async () => {
    const status = await window.electronAPI.getSyncStatus()
    setSyncStatus(status)
  }

  const loadStats = async () => {
    const newStats = await window.electronAPI.getStats()
    setStats(newStats)
  }

  const handleStartSync = async () => {
    setIsStarting(true)
    try {
      const result = await window.electronAPI.startSync('manual')
      if (!result.success) {
        alert(`Error en sincronización: ${result.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>Lina Sync App</h1>
      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '30px' }}>Sincroniza tus documentos con el asistente</p>

      {/* Sync Status Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Estado de Sincronización</h2>
          <button
            onClick={handleStartSync}
            disabled={syncStatus?.isRunning || isStarting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: syncStatus?.isRunning ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: syncStatus?.isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            <PlayCircle size={18} />
            {syncStatus?.isRunning ? 'Sincronizando...' : 'Iniciar Sincronización'}
          </button>
        </div>

        {syncStatus?.isRunning && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${syncStatus.progress}%`,
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s',
              }} />
            </div>
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
              {syncStatus.progress}% completado
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          <StatCard icon={<FolderOpen size={24} />} label="Archivos Escaneados" value={syncStatus?.filesScanned || 0} color="#3b82f6" />
          <StatCard icon={<CheckCircle size={24} />} label="Archivos Nuevos" value={syncStatus?.filesNew || 0} color="#10b981" />
          <StatCard icon={<Clock size={24} />} label="Actualizados" value={syncStatus?.filesUpdated || 0} color="#f59e0b" />
          <StatCard icon={<MinusCircle size={24} />} label="Sin Cambios" value={syncStatus?.filesSkipped || 0} color="#6b7280" />
          <StatCard icon={<XCircle size={24} />} label="Eliminados" value={syncStatus?.filesDeleted || 0} color="#ef4444" />
          <StatCard icon={<AlertCircle size={24} />} label="Fallidos" value={syncStatus?.filesFailed || 0} color="#ef4444" />
          <StatCard icon={<CheckCircle size={24} />} label="Bytes Procesados" value={formatBytes(syncStatus?.bytesProcessed || 0)} color="#3b82f6" />
        </div>
      </div>

      {/* Overall Stats */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Estadísticas Generales</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total Archivos Sincronizados</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>{stats.totalFiles}</p>
          </div>
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Archivos Fallidos</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{stats.failedFiles}</p>
          </div>
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Última Sincronización</p>
            <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
              {stats.lastSyncAt ? formatTimestamp(stats.lastSyncAt) : 'Nunca'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
    }}>
      <div style={{ color }}>{icon}</div>
      <div>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</p>
        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{value}</p>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `hace ${minutes}m`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7) return `hace ${days}d`
  return date.toLocaleDateString('es-ES')
}
