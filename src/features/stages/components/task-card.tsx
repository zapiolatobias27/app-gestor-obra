"use client"

import React, { useState, useRef, useEffect } from "react"
import { Task, TaskStatus, UserRole } from "@/types/project"
import { updateTaskStatus, updateTaskObservations, addPhotoToTask, getTaskPhotos, deletePhoto } from "@/lib/mock-db"
import { PhotoUpload } from "@/features/photos/components/photo-upload"

interface TaskCardProps {
  task: Task
  currentUserId?: string
  currentUserRole?: UserRole
}

const STATUS_BUTTONS: { status: TaskStatus; label: string; activeClass: string }[] = [
  { status: "pending",    label: "Pendiente",  activeClass: "status-btn-pending-active" },
  { status: "in_progress",label: "En Proceso", activeClass: "status-btn-progress-active" },
  { status: "completed",  label: "Completada", activeClass: "status-btn-done-active" },
  { status: "blocked",    label: "Bloqueada",  activeClass: "status-btn-blocked-active" },
]

const STATUS_IDLE: Record<TaskStatus, string> = {
  pending:     "status-btn-pending",
  in_progress: "status-btn-progress",
  completed:   "status-btn-done",
  blocked:     "status-btn-blocked",
}

const ROLE_CHIP: Record<UserRole, string> = {
  architect:  "responsible-chip responsible-architect",
  supervisor: "responsible-chip responsible-supervisor",
  owner:      "responsible-chip responsible-owner",
}

const ROLE_LABEL: Record<UserRole, string> = {
  architect:  "Arquitecto",
  supervisor: "Capataz",
  owner:      "Propietario",
}


export function TaskCard({ task, currentUserId, currentUserRole }: TaskCardProps) {
  const [status, setStatus]       = useState<TaskStatus>(task.status)
  const [observations, setObs]    = useState(task.observations ?? "")
  const [photos, setPhotos]         = useState(task.photos)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [lightboxPhoto, setLightboxPhoto]   = useState<typeof task.photos[0] | null>(null)
  const obsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getTaskPhotos(task.id).then(setPhotos)
  }, [task.id])

  const handleStatus = async (s: TaskStatus) => {
    setStatus(s)
    await updateTaskStatus(task.id, s)
  }

  const handleObs = (val: string) => {
    setObs(val)
    if (obsTimer.current) clearTimeout(obsTimer.current)
    obsTimer.current = setTimeout(() => { updateTaskObservations(task.id, val) }, 600)
  }

  const handleAddPhoto = async (url: string, caption?: string) => {
    const who = currentUserId ?? "user"
    const newPhoto = await addPhotoToTask(task.id, task.stageId, url, caption ?? "", who)
    setPhotos((p) => [...p, newPhoto])
    setShowPhotoModal(false)
  }

  const handleDeletePhoto = async (photoId: string) => {
    await deletePhoto(photoId)
    setPhotos((p) => p.filter((ph) => ph.id !== photoId))
    if (lightboxPhoto?.id === photoId) setLightboxPhoto(null)
  }

  return (
    <article className={`task-card ${status === "blocked" ? "task-card-blocked" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span className="task-category">{task.category}</span>
          <h4 className="task-title">{task.title}</h4>
          {task.description && <p className="task-desc">{task.description}</p>}
        </div>
        <span className={ROLE_CHIP[task.responsibleRole]}>
          {ROLE_LABEL[task.responsibleRole]}
        </span>
      </div>

      {/* Meta fechas */}
      {(task.weekStart || task.startDate) && (
        <p className="task-meta mb-3">
          {task.weekStart && task.weekEnd
            ? `Semanas ${task.weekStart}–${task.weekEnd}`
            : task.startDate
              ? `Inicio: ${new Date(task.startDate).toLocaleDateString("es-AR")}`
              : ""}
          {task.completedAt
            ? ` · Completada ${new Date(task.completedAt).toLocaleDateString("es-AR")}`
            : ""}
        </p>
      )}

      {/* Selector de estado */}
      <div className="flex gap-1.5 mb-3">
        {STATUS_BUTTONS.map(({ status: s, label, activeClass }) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatus(s)}
            className={`status-btn ${status === s ? activeClass : STATUS_IDLE[s]}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Observaciones */}
      <div className="mb-3">
        <label htmlFor={`obs-${task.id}`} className="obs-label">Observaciones</label>
        <textarea
          id={`obs-${task.id}`}
          rows={2}
          value={observations}
          onChange={(e) => handleObs(e.target.value)}
          placeholder="Agregar observaciones de campo..."
          className="obs-textarea"
        />
      </div>

      {/* Fotos */}
      <div>
        <span className="obs-label">Registro fotográfico ({photos.length})</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {photos.map((p) => (
            <div key={p.id} className="photo-thumb-wrap">
              <button
                type="button"
                className="photo-thumb-btn"
                onClick={() => setLightboxPhoto(p)}
                aria-label={p.caption ?? "Ver foto"}
              >
                <img src={p.url} alt={p.caption ?? "Foto de tarea"} className="photo-thumb" />
              </button>
              <button
                type="button"
                className="photo-thumb-delete"
                onClick={() => handleDeletePhoto(p.id)}
                aria-label="Eliminar foto"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="photo-add-btn"
            aria-label="Agregar foto"
          >
            +
          </button>
        </div>
      </div>

      {/* Modal agregar foto */}
      {showPhotoModal && (
        <div className="photo-modal-wrap space-y-2">
          <PhotoUpload onUpload={handleAddPhoto} />
          <button
            type="button"
            onClick={() => setShowPhotoModal(false)}
            className="status-btn status-btn-pending w-full"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="photo-lightbox" onClick={() => setLightboxPhoto(null)}>
          <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxPhoto.url} alt={lightboxPhoto.caption ?? "Foto"} className="photo-lightbox-img" />
            {lightboxPhoto.caption && <p className="photo-lightbox-caption">{lightboxPhoto.caption}</p>}
            <p className="photo-lightbox-meta">
              {new Date(lightboxPhoto.uploadedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <button type="button" className="photo-lightbox-close" onClick={() => setLightboxPhoto(null)}>✕</button>
          </div>
        </div>
      )}
    </article>
  )
}
