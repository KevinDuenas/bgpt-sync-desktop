/**
 * Main App Component
 */
import React, { useState, useEffect } from 'react'
import { Settings, FolderSync, History, PlayCircle, Calendar, Download, RefreshCw } from 'lucide-react'
import Dashboard from './components/Dashboard'
import SettingsPage from './components/SettingsPage'
import FoldersPage from './components/FoldersPage'
import HistoryPage from './components/HistoryPage'
import SchedulePage from './components/SchedulePage'
import { UpdateStatus } from './global.d'

type Page = 'dashboard' | 'folders' | 'schedule' | 'history' | 'settings'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [isConfigured, setIsConfigured] = useState(false)
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    checkConfiguration()
    loadAppVersion()

    // Listen for update status changes
    window.electronAPI.onUpdateStatus((status) => {
      setUpdateStatus(status)
    })

    return () => {
      window.electronAPI.offUpdateStatus()
    }
  }, [])

  const loadAppVersion = async () => {
    const version = await window.electronAPI.getAppVersion()
    setAppVersion(version)
  }

  const handleCheckForUpdates = async () => {
    setUpdateStatus({ status: 'checking' })
    await window.electronAPI.checkForUpdates()
  }

  const handleInstallUpdate = () => {
    window.electronAPI.installUpdate()
  }

  const checkConfiguration = async () => {
    const config = await window.electronAPI.getConfig()
    setIsConfigured(!!config)
    if (!config) {
      setCurrentPage('settings')
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'folders':
        return <FoldersPage />
      case 'schedule':
        return <SchedulePage />
      case 'history':
        return <HistoryPage />
      case 'settings':
        return <SettingsPage onConfigured={() => setIsConfigured(true)} />
      default:
        return <Dashboard />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: 250,
        backgroundColor: '#1f2937',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #374151',
          fontSize: '20px',
          fontWeight: 'bold',
        }}>
          Business GPT Sync
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '20px 10px' }}>
          <NavButton
            icon={<PlayCircle size={20} />}
            label="Inicio"
            active={currentPage === 'dashboard'}
            onClick={() => setCurrentPage('dashboard')}
            disabled={!isConfigured}
          />
          <NavButton
            icon={<FolderSync size={20} />}
            label="Carpetas"
            active={currentPage === 'folders'}
            onClick={() => setCurrentPage('folders')}
            disabled={!isConfigured}
          />
          <NavButton
            icon={<Calendar size={20} />}
            label="Programar"
            active={currentPage === 'schedule'}
            onClick={() => setCurrentPage('schedule')}
            disabled={!isConfigured}
          />
          <NavButton
            icon={<History size={20} />}
            label="Historial"
            active={currentPage === 'history'}
            onClick={() => setCurrentPage('history')}
            disabled={!isConfigured}
          />
          <div style={{ marginTop: 'auto' }}>
            <NavButton
              icon={<Settings size={20} />}
              label="Configuración"
              active={currentPage === 'settings'}
              onClick={() => setCurrentPage('settings')}
            />
          </div>
        </nav>

        {/* Footer with version and update */}
        <div style={{
          padding: '15px',
          borderTop: '1px solid #374151',
          fontSize: '12px',
          color: '#9ca3af',
        }}>
          {updateStatus?.status === 'downloaded' ? (
            <button
              onClick={handleInstallUpdate}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Download size={14} />
              Instalar v{updateStatus.version}
            </button>
          ) : updateStatus?.status === 'downloading' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '4px' }}>Descargando... {updateStatus.percent}%</div>
              <div style={{
                height: '4px',
                backgroundColor: '#374151',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${updateStatus.percent}%`,
                  backgroundColor: '#3b82f6',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          ) : updateStatus?.status === 'available' ? (
            <div style={{ textAlign: 'center', color: '#10b981' }}>
              Nueva version disponible: v{updateStatus.version}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>v{appVersion}</span>
              <button
                onClick={handleCheckForUpdates}
                disabled={updateStatus?.status === 'checking'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: updateStatus?.status === 'checking' ? 'default' : 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Buscar actualizaciones"
              >
                <RefreshCw
                  size={14}
                  style={{
                    animation: updateStatus?.status === 'checking' ? 'spin 1s linear infinite' : 'none'
                  }}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderPage()}
      </div>
    </div>
  )
}

interface NavButtonProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}

function NavButton({ icon, label, active, onClick, disabled }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        marginBottom: '8px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: active ? '#374151' : 'transparent',
        color: disabled ? '#6b7280' : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: active ? '600' : '400',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.backgroundColor = '#374151'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
    >
      {icon}
      {label}
    </button>
  )
}
