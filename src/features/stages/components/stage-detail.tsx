"use client"

import React, { useMemo, useState } from "react"
import { Stage, Task, TaskStatus, UserRole } from "@/types/project"
import { addTask, getTasksByStage, updateStage } from "@/lib/mock-db"
import { TaskCard } from "./task-card"
import { StagePhotosSection } from "./stage-photos-section"
import { StageMaterialsSection } from "./stage-materials-section"

interface StageDetailProps {
  stage: Stage
  tasks: Task[]
  currentUserId?: string
  currentUserRole?: UserRole
}

const ROLES: UserRole[] = ["owner", "architect", "supervisor"]
const ROLE_LABEL: Record<UserRole, string> = {
  owner:      "Propietario",
  architect:  "Arquitecto",
  supervisor: "Capataz",
}

function AddTaskForm({ stageId, onAdded }: { stageId: string; onAdded: () => void }) {
  const [title, setTitle]       = useState("")
  const [category, setCategory] = useState("")
  const [description, setDesc]  = useState("")
  const [role, setRole]         = useState<UserRole>("supervisor")
  const [error, setError]       = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim())    { setError("El título es obligatorio."); return }
    if (!category.trim()) { setError("La categoría es obligatoria."); return }
    await addTask({
      id: `task-${Date.now()}`,
      stageId,
      title: title.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      status: "pending",
      responsibleRole: role,
      photos: [],
    })
    setTitle(""); setCategory(""); setDesc(""); setError("")
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="add-task-form">
      <p className="add-task-form-title">Nueva tarea</p>
      {error && <p className="proj-form-error">{error}</p>}
      <div className="add-task-grid">
        <label className="block text-sm col-span-2">
          <span className="proj-form-label">Título *</span>
          <input
            className="proj-form-input mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Replanteo de ejes"
          />
        </label>
        <label className="block text-sm">
          <span className="proj-form-label">Categoría *</span>
          <input
            className="proj-form-input mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej: Hormigón"
          />
        </label>
        <label className="block text-sm">
          <span className="proj-form-label">Responsable</span>
          <select
            className="proj-form-input mt-1"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm col-span-2">
          <span className="proj-form-label">Descripción (opcional)</span>
          <input
            className="proj-form-input mt-1"
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Detalle adicional..."
          />
        </label>
      </div>
      <button type="submit" className="proj-btn-primary mt-1">Agregar tarea</button>
    </form>
  )
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending:     "Pendiente",
  in_progress: "En Proceso",
  completed:   "Completada",
  blocked:     "Bloqueada",
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending:     "badge-pending",
  in_progress: "badge-progress",
  completed:   "badge-done",
  blocked:     "badge-blocked",
}

export function StageDetail({ stage, tasks: initialTasks, currentUserId, currentUserRole }: StageDetailProps) {
  const [tasks, setTasks]         = useState<Task[]>(initialTasks)
  const [showForm, setShowForm]   = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [stageName, setStageName]     = useState(stage.name)
  const [savingName, setSavingName]   = useState(false)

  const handleSaveName = async () => {
    const trimmed = stageName.trim()
    if (!trimmed || trimmed === stage.name) { setEditingName(false); return }
    setSavingName(true)
    await updateStage({ ...stage, name: trimmed })
    stage.name = trimmed
    setSavingName(false)
    setEditingName(false)
  }

  const reload = async () => { const t = await getTasksByStage(stage.id); setTasks(t) }

  const completedCount = useMemo(() => tasks.filter((t) => t.status === "completed").length, [tasks])
  const blockedCount   = useMemo(() => tasks.filter((t) => t.status === "blocked").length, [tasks])
  const pct            = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  const byCategory = useMemo(() => {
    return tasks.reduce<Record<string, Task[]>>((acc, t) => {
      if (!acc[t.category]) acc[t.category] = []
      acc[t.category].push(t)
      return acc
    }, {})
  }, [tasks])

  return (
    <div className="page-wrap space-y-6">

      {/* Header etapa */}
      <div className="card-obra p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="page-eyebrow">{stage.code}</p>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  className="proj-form-input text-xl font-bold flex-1"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setStageName(stage.name); setEditingName(false) } }}
                  autoFocus
                />
                <button type="button" className="proj-btn-primary" onClick={handleSaveName} disabled={savingName}>
                  {savingName ? "…" : "Guardar"}
                </button>
                <button type="button" className="proj-btn-ghost" onClick={() => { setStageName(stage.name); setEditingName(false) }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="page-title">{stageName}</h2>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-stone-400 hover:text-stone-700 transition-colors flex-shrink-0"
                  title="Editar nombre de etapa"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                  </svg>
                </button>
              </div>
            )}
            {(stage.weekStart && stage.weekEnd) && (
              <p className="page-subtitle mt-1">
                Semanas {stage.weekStart}–{stage.weekEnd}
                {stage.startDate && ` · Inicio ${new Date(stage.startDate).toLocaleDateString("es-AR")}`}
                {stage.endDate   && ` · Fin ${new Date(stage.endDate).toLocaleDateString("es-AR")}`}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[stage.status]}`}>
              {STATUS_LABEL[stage.status]}
            </span>
            {blockedCount > 0 && (
              <span className="badge-blocked px-3 py-1 rounded-full text-xs font-semibold">
                {blockedCount} bloqueada{blockedCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-4">
          <div className="flex justify-between mb-1.5">
            <span className="task-meta">Progreso de tareas</span>
            <span className="task-meta font-semibold">{completedCount}/{tasks.length} · {pct}%</span>
          </div>
          {/* Progress width is runtime-calculated; inline style is unavoidable here */}
          {/* stylelint-disable-next-line */}
          <div className="progress-track" data-pct={pct}>
            <div
              className={`progress-fill ${stage.status === "completed" ? "progress-fill-done" : ""}`}
              ref={(el) => { if (el) el.style.width = `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tareas por categoría */}
      {tasks.length === 0 ? (
        <div className="card-obra p-8 text-center">
          <p className="section-title">Sin tareas asignadas</p>
          <p className="page-subtitle mt-1">Usá el botón de abajo para agregar la primera tarea</p>
        </div>
      ) : (
        Object.entries(byCategory).map(([category, catTasks]) => (
          <div key={category} className="space-y-3">
            <h3 className="section-title px-1">{category}</h3>
            {catTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
              />
            ))}
          </div>
        ))
      )}

      {/* Materiales de la etapa (importados del Excel) */}
      <StageMaterialsSection stageId={stage.id} />

      {/* Álbum de fotos de la etapa */}
      <StagePhotosSection stageId={stage.id} currentUserId={currentUserId ?? "usuario"} />

      {/* Botón / formulario agregar tarea */}
      {showForm ? (
        <div className="card-obra p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">Agregar tarea</h3>
            <button
              type="button"
              className="proj-btn-ghost-sm"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
          </div>
          <AddTaskForm
            stageId={stage.id}
            onAdded={() => { reload(); setShowForm(false) }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="add-task-trigger"
          onClick={() => setShowForm(true)}
        >
          + Agregar tarea
        </button>
      )}
    </div>
  )
}
