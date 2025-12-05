/**
 * Settings Page Component
 */
import { useState, useEffect } from 'react'
import { Save, Key, CheckCircle } from 'lucide-react'
import { AppConfig } from '../../shared/types'

interface SettingsPageProps {
  onConfigured: () => void
}

export default function SettingsPage({ onConfigured }: SettingsPageProps) {
  const [apiToken, setApiToken] = useState('')
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    const existingConfig = await window.electronAPI.getConfig()
    if (existingConfig) {
      setConfig(existingConfig)
      setApiToken(existingConfig.apiToken)
    }
  }

  const handleSave = async () => {
    if (!apiToken) {
      setMessage('Por favor ingresa el Token de API')
      setIsError(true)
      return
    }

    setIsSaving(true)
    setMessage('')
    setIsError(false)

    try {
      const result = await window.electronAPI.setConfig(apiToken)

      if (result.success) {
        setMessage(`Conectado a ${result.companyName}`)
        setIsError(false)
        // Reload config to get full data
        await loadConfig()
        onConfigured()
      } else {
        setMessage(result.error || 'Error al validar el token')
        setIsError(true)
      }
    } catch (error) {
      setMessage(`Error: ${error}`)
      setIsError(true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
        <Key size={32} />
        <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Configuración</h1>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Configuración de API</h2>

        {/* Show connected status if configured */}
        {config?.companyName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#d1fae5',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            <CheckCircle size={20} color="#065f46" />
            <span style={{ color: '#065f46', fontWeight: '500' }}>
              Conectado a: {config.companyName}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#374151',
            }}>
              Token de API
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="bgpt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'monospace',
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Obtén esto desde la página de Tokens de API en el panel de administración
            </p>
          </div>
        </div>

        {message && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: isError ? '#fee2e2' : '#d1fae5',
            color: isError ? '#991b1b' : '#065f46',
            borderRadius: '6px',
            fontSize: '14px',
          }}>
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            marginTop: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          <Save size={18} />
          {isSaving ? 'Validando...' : 'Guardar y Conectar'}
        </button>
      </div>
    </div>
  )
}
