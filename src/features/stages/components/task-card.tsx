"use client"

import React, { useState, useRef } from "react"
import { Task, TaskStatus, UserRole } from "@/types/project"
import { SupplyItem } from "@/types/stock"
import { updateTaskStatus, updateTaskObservations, addPhotoToTask, addSupply, updateSupply, deleteSupply, getSupplies, updateSupplyCurrentStock } from "@/lib/mock-db"
import { parseNum } from "@/lib/parseNum"
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

function TaskMaterials({ task }: { task: Task }) {
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [open, setOpen]         = useState(false)
  const [showAdd, setShowAdd]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [useAmounts, setUseAmounts] = useState<Record<string, string>>({})

  const [name, setName]   = useState("")
  const [unit, setUnit]   = useState("")
  const [qty,  setQty]    = useState("")
  const [stock, setStock] = useState("")
  const [formErr, setFormErr] = useState("")
  const [editQty, setEditQty] = useState("")

  const reload = async () => {
    const all = await getSupplies()
    setSupplies(all.filter((s) => s.taskId === task.id))
  }

  React.useEffect(() => { reload() }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setFormErr("Ingresá el nombre del material."); return }
    if (!unit.trim()) { setFormErr("Ingresá la unidad."); return }
    await addSupply({
      id: `sup-${Date.now()}`,
      stageId: task.stageId,
      taskId: task.id,
      name: name.trim(),
      unit: unit.trim(),
      plannedQty: parseNum(qty),
      realQty: 0,
      currentStock: parseNum(stock) || undefined,
    })
    setName(""); setUnit(""); setQty(""); setStock(""); setFormErr("")
    setShowAdd(false)
    reload()
  }

  const handleDelete = async (id: string) => {
    await deleteSupply(id)
    reload()
  }

  const startEdit = (s: SupplyItem) => {
    setEditingId(s.id)
    setEditQty(s.plannedQty.toString())
  }

  const saveEdit = async (s: SupplyItem) => {
    await updateSupply({ ...s, plannedQty: parseNum(editQty) })
    setEditingId(null)
    reload()
  }

  const handleUse = async (s: SupplyItem) => {
    const amount = parseNum(useAmounts[s.id])
    if (amount <= 0) return
    const current = s.currentStock ?? 0
    const newStock = Math.max(0, current - amount)
    await updateSupplyCurrentStock(s.id, newStock)
    await updateSupply({ ...s, realQty: (s.realQty ?? 0) + amount, currentStock: newStock })
    setUseAmounts((prev) => ({ ...prev, [s.id]: "" }))
    reload()
  }

  const stockColor = (s: SupplyItem) => {
    if (s.currentStock == null) return ""
    if (s.plannedQty > 0 && s.currentStock <= s.plannedQty * 0.2) return "task-mat-stock-low"
    if (s.currentStock === 0) return "task-mat-stock-empty"
    return "task-mat-stock-ok"
  }

  return (
    <div className="task-materials">
      <button
        type="button"
        className="task-materials-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span>🧱 Materiales</span>
        <span className="task-materials-count">{supplies.length > 0 ? supplies.length : "ninguno"}</span>
        <span className="task-materials-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="task-materials-body">
          {supplies.length > 0 ? (
            <table className="task-mat-table">
              <thead>
                <tr>
                  <th className="task-mat-th text-left">Material</th>
                  <th className="task-mat-th text-right">Planif.</th>
                  <th className="task-mat-th text-right">Disponible</th>
                  <th className="task-mat-th text-left">Unidad</th>
                  <th className="task-mat-th text-left">Usar</th>
                  <th className="task-mat-th"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((s) => (
                  <tr key={s.id} className="task-mat-row">
                    <td className="task-mat-td font-medium">{s.name}</td>

                    {/* Cantidad planificada — editable */}
                    <td className="task-mat-td text-right tabular-nums">
                      {editingId === s.id ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className="task-mat-input"
                          value={editQty}
                          aria-label={`Cantidad planificada de ${s.name}`}
                          onChange={(e) => setEditQty(e.target.value)}
                          onBlur={() => saveEdit(s)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s) }}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="task-mat-edit-btn"
                          onClick={() => startEdit(s)}
                          title="Editar cantidad planificada"
                        >
                          {s.plannedQty || "—"}
                        </button>
                      )}
                    </td>

                    {/* Stock disponible */}
                    <td className={`task-mat-td text-right tabular-nums font-semibold ${stockColor(s)}`}>
                      {s.currentStock != null ? s.currentStock : <span className="text-stone-300">—</span>}
                    </td>

                    <td className="task-mat-td text-stone-400">{s.unit}</td>

                    {/* Usar: input + botón descuento */}
                    <td className="task-mat-td">
                      <div className="task-mat-use-row">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="task-mat-input task-mat-use-input"
                          placeholder="0"
                          aria-label={`Cantidad a usar de ${s.name}`}
                          value={useAmounts[s.id] ?? ""}
                          onChange={(e) => setUseAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUse(s) }}
                        />
                        <button
                          type="button"
                          className="task-mat-use-btn"
                          onClick={() => handleUse(s)}
                          title="Descontar del stock"
                          disabled={!(parseNum(useAmounts[s.id]) > 0)}
                        >
                          −
                        </button>
                      </div>
                    </td>

                    <td className="task-mat-td text-right">
                      <button
                        type="button"
                        className="task-mat-del-btn"
                        onClick={() => handleDelete(s.id)}
                        title="Eliminar material"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="task-mat-empty">Sin materiales cargados</p>
          )}

          {showAdd ? (
            <form onSubmit={handleAdd} className="task-mat-add-form">
              {formErr && <p className="proj-form-error text-xs">{formErr}</p>}
              <div className="task-mat-add-row">
                <input
                  className="proj-form-input task-mat-add-name"
                  placeholder="Material *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="proj-form-input task-mat-add-qty"
                  placeholder="Planif."
                  type="text"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
                <input
                  className="proj-form-input task-mat-add-qty"
                  placeholder="Stock"
                  type="text"
                  inputMode="decimal"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
                <input
                  className="proj-form-input task-mat-add-unit"
                  placeholder="Unidad *"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
                <button type="submit" className="proj-btn-primary">+</button>
                <button type="button" className="proj-btn-ghost-sm" onClick={() => { setShowAdd(false); setFormErr("") }}>✕</button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="task-mat-add-trigger"
              onClick={() => setShowAdd(true)}
            >
              + Agregar material
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function TaskCard({ task, currentUserId, currentUserRole }: TaskCardProps) {
  const [status, setStatus]       = useState<TaskStatus>(task.status)
  const [observations, setObs]    = useState(task.observations ?? "")
  const [photos, setPhotos]       = useState(task.photos)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const obsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      {/* Materiales */}
      <TaskMaterials task={task} />

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
          {photos.slice(0, 5).map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
              <img src={p.url} alt={p.caption ?? "Foto de tarea"} className="photo-thumb" />
            </a>
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
    </article>
  )
}
