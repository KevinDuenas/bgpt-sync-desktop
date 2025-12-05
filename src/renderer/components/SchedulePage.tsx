/**
 * Schedule Page Component
 */
import React, { useState, useEffect } from 'react'
import { Calendar, Clock, Save } from 'lucide-react'
import { ScheduleConfig } from '@shared/types'

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    enabled: false,
    frequency: 'manual',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSchedule()
  }, [])

  const loadSchedule = async () => {
    const data = await window.electronAPI.getSchedule()
    if (data) {
      setSchedule(data)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage('')

    try {
      await window.electronAPI.setSchedule(schedule)
      setMessage('¡Programación actualizada exitosamente!')
    } catch (error) {
      setMessage(`Error: ${error}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
        <Calendar size={32} />
        <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Programar Sincronización</h1>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
            style={{ width: '20px', height: '20px' }}
          />
          <label style={{ fontSize: '16px', fontWeight: '600' }}>Habilitar Sincronización Automática</label>
        </div>

        {schedule.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#374151',
              }}>
                Frecuencia
              </label>
              <select
                value={schedule.frequency}
                onChange={(e) => setSchedule({
                  ...schedule,
                  frequency: e.target.value as any,
                  time: e.target.value === 'hourly' ? undefined : schedule.time,
                  dayOfWeek: e.target.value === 'weekly' ? schedule.dayOfWeek : undefined,
                })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="hourly">Cada Hora</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="manual">Solo Manual</option>
              </select>
            </div>

            {(schedule.frequency === 'daily' || schedule.frequency === 'weekly') && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#374151',
                }}>
                  Hora
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="#6b7280" />
                  <input
                    type="time"
                    value={schedule.time || '00:00'}
                    onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>
            )}

            {schedule.frequency === 'weekly' && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#374151',
                }}>
                  Día de la Semana
                </label>
                <select
                  value={schedule.dayOfWeek ?? 0}
                  onChange={(e) => setSchedule({ ...schedule, dayOfWeek: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value={0}>Domingo</option>
                  <option value={1}>Lunes</option>
                  <option value={2}>Martes</option>
                  <option value={3}>Miércoles</option>
                  <option value={4}>Jueves</option>
                  <option value={5}>Viernes</option>
                  <option value={6}>Sábado</option>
                </select>
              </div>
            )}

            <div style={{
              padding: '16px',
              backgroundColor: '#eff6ff',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '6px',
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1e40af' }}>
                Resumen de Programación
              </h4>
              <p style={{ fontSize: '14px', color: '#1e40af' }}>
                {getScheduleSummary(schedule)}
              </p>
            </div>
          </div>
        )}

        {!schedule.enabled && (
          <div style={{
            padding: '24px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              La sincronización automática está deshabilitada. Los archivos solo se sincronizarán cuando inicies una sincronización manualmente.
            </p>
          </div>
        )}

        {message && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: message.includes('Error') ? '#fee2e2' : '#d1fae5',
            color: message.includes('Error') ? '#991b1b' : '#065f46',
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
          }}
        >
          <Save size={18} />
          {isSaving ? 'Guardando...' : 'Guardar Programación'}
        </button>
      </div>
    </div>
  )
}

function getScheduleSummary(schedule: ScheduleConfig): string {
  if (!schedule.enabled) {
    return 'Solo sincronización manual'
  }

  switch (schedule.frequency) {
    case 'hourly':
      return 'Sincroniza cada hora'
    case 'daily':
      return `Sincroniza diariamente a las ${schedule.time || '00:00'}`
    case 'weekly': {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const day = days[schedule.dayOfWeek ?? 0]
      return `Sincroniza cada ${day} a las ${schedule.time || '00:00'}`
    }
    case 'manual':
      return 'Solo sincronización manual'
    default:
      return 'Programación personalizada'
  }
}
