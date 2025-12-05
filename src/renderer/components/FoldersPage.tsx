/**
 * Folders Page Component
 */
import React, { useState, useEffect } from 'react'
import { FolderPlus, Trash2, Edit2, FolderOpen, CheckCircle, XCircle } from 'lucide-react'
import { FolderConfig, Group } from '@shared/types'

export default function FoldersPage() {
  const [folders, setFolders] = useState<FolderConfig[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFolder, setEditingFolder] = useState<FolderConfig | null>(null)

  useEffect(() => {
    loadFolders()
    loadGroups()
  }, [])

  const loadFolders = async () => {
    const data = await window.electronAPI.getFolders()
    setFolders(data)
  }

  const loadGroups = async () => {
    const data = await window.electronAPI.getGroups()
    setGroups(data)
  }

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta configuración de carpeta?')) {
      await window.electronAPI.deleteFolder(id)
      loadFolders()
    }
  }

  const handleToggle = async (folder: FolderConfig) => {
    await window.electronAPI.updateFolder(folder.id, { enabled: !folder.enabled })
    loadFolders()
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Configuración de Carpetas</h1>
        <button
          onClick={() => setShowAddModal(true)}
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
          <FolderPlus size={18} />
          Agregar Carpeta
        </button>
      </div>

      <div style={{ display: 'grid', gap: '20px' }}>
        {folders.map((folder) => (
          <div
            key={folder.id}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              opacity: folder.enabled ? 1 : 0.6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FolderOpen size={24} color="#3b82f6" />
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{folder.localPath}</h3>
                  {folder.enabled ? (
                    <CheckCircle size={20} color="#10b981" />
                  ) : (
                    <XCircle size={20} color="#6b7280" />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '16px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Incluir Subcarpetas</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>{folder.includeSubfolders ? 'Sí' : 'No'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Ignorar Archivos Ocultos</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>{folder.ignoreHidden ? 'Sí' : 'No'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Extensiones de Archivo</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>
                      {folder.fileExtensions ? folder.fileExtensions.join(', ') : 'Todos'}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Tamaño Máximo</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>
                      {folder.maxFileSizeMb ? `${folder.maxFileSizeMb} MB` : 'Sin límite'}
                    </p>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Grupos</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>
                      {folder.groupIds.length > 0
                        ? groups.filter(g => folder.groupIds.includes(g.id)).map(g => g.name).join(', ')
                        : 'Sin grupos'}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginLeft: '20px' }}>
                <button
                  onClick={() => handleToggle(folder)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: folder.enabled ? '#6b7280' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {folder.enabled ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => setEditingFolder(folder)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(folder.id)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#fee2e2',
                    color: '#ef4444',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {folders.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '60px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <FolderOpen size={64} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No hay carpetas configuradas</h3>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>Agrega una carpeta para comenzar a sincronizar archivos</p>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
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
              Agregar Tu Primera Carpeta
            </button>
          </div>
        )}
      </div>

      {(showAddModal || editingFolder) && (
        <FolderModal
          folder={editingFolder}
          groups={groups}
          onClose={() => {
            setShowAddModal(false)
            setEditingFolder(null)
          }}
          onSave={() => {
            setShowAddModal(false)
            setEditingFolder(null)
            loadFolders()
          }}
        />
      )}
    </div>
  )
}

interface FolderModalProps {
  folder: FolderConfig | null
  groups: Group[]
  onClose: () => void
  onSave: () => void
}

function FolderModal({ folder, groups, onClose, onSave }: FolderModalProps) {
  const [formData, setFormData] = useState<Omit<FolderConfig, 'id'>>({
    localPath: folder?.localPath || '',
    includeSubfolders: folder?.includeSubfolders ?? true,
    fileExtensions: folder?.fileExtensions || null,
    maxFileSizeMb: folder?.maxFileSizeMb || null,
    groupIds: folder?.groupIds || [],
    ignoreHidden: folder?.ignoreHidden ?? true,
    enabled: folder?.enabled ?? true,
  })

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setFormData({ ...formData, localPath: path })
    }
  }

  const handleSave = async () => {
    if (!formData.localPath) {
      alert('Por favor selecciona una carpeta')
      return
    }

    if (folder) {
      await window.electronAPI.updateFolder(folder.id, formData)
    } else {
      await window.electronAPI.addFolder(formData)
    }
    onSave()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        width: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>
          {folder ? 'Editar Carpeta' : 'Agregar Carpeta'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Ruta de Carpeta *
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={formData.localPath}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={handleSelectFolder}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Buscar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={formData.includeSubfolders}
              onChange={(e) => setFormData({ ...formData, includeSubfolders: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <label style={{ fontSize: '14px', fontWeight: '500' }}>Incluir subcarpetas</label>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={formData.ignoreHidden}
              onChange={(e) => setFormData({ ...formData, ignoreHidden: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <label style={{ fontSize: '14px', fontWeight: '500' }}>Ignorar archivos ocultos</label>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Extensiones de Archivo (separadas por coma, dejar vacío para todos)
            </label>
            <input
              type="text"
              value={formData.fileExtensions?.join(', ') || ''}
              onChange={(e) => setFormData({
                ...formData,
                fileExtensions: e.target.value ? e.target.value.split(',').map(s => s.trim()) : null
              })}
              placeholder=".pdf, .docx, .txt"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Tamaño Máximo de Archivo (MB, dejar vacío para sin límite)
            </label>
            <input
              type="number"
              value={formData.maxFileSizeMb || ''}
              onChange={(e) => setFormData({
                ...formData,
                maxFileSizeMb: e.target.value ? parseInt(e.target.value) : null
              })}
              placeholder="100"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Grupos (permisos)
            </label>
            <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '12px' }}>
              {groups.map(group => (
                <div key={group.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={formData.groupIds.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, groupIds: [...formData.groupIds, group.id] })
                      } else {
                        setFormData({ ...formData, groupIds: formData.groupIds.filter(id => id !== group.id) })
                      }
                    }}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label style={{ fontSize: '14px' }}>{group.name}</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
