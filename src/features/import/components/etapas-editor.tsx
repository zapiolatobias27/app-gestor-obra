"use client"

import React, { useEffect, useState } from "react"
import { Stage, TaskStatus } from "@/types/project"
import { addStage, deleteStage, getStages, updateStage } from "@/lib/mock-db"

const NEW = "__new__"
const STATUSES: TaskStatus[] = ["pending", "in_progress", "completed", "blocked"]
const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  completed: "Completada",
  blocked: "Bloqueada",
}

const empty = (): Stage => ({
  id: "",
  projectId: "proj-1",
  code: "",
  name: "",
  order: 1,
  status: "pending",
})

function Chevron({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export function EtapasEditor({ onSaved }: { onSaved?: () => void }) {
  const [stages, setStages] = useState<Stage[]>([])
  const [selectedId, setSelectedId] = useState<string>(NEW)
  const [form, setForm] = useState<Stage>(empty())
  const [toast, setToast] = useState("")
  const [showExtra, setShowExtra] = useState(false)

  const refresh = () => setStages(getStages())

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (selectedId === NEW) {
      setForm({ ...empty(), order: stages.length + 1, id: `s-${Date.now()}` })
    } else {
      const found = stages.find((s) => s.id === selectedId)
      if (found) setForm({ ...found })
    }
  }, [selectedId, stages])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2200)
  }

  const handleSave = (): void => {
    if (!form.name.trim() || !form.code.trim()) {
      showToast("Completá código y nombre")
      return
    }
    if (selectedId === NEW) {
      addStage(form)
      showToast("Etapa creada ✓")
    } else {
      updateStage(form)
      showToast("Etapa actualizada ✓")
    }
    refresh()
    setSelectedId(NEW)
    onSaved?.()
  }

  const handleDelete = (): void => {
    if (selectedId === NEW) return
    if (!confirm("¿Eliminar etapa? También se borrarán sus tareas, insumos y compras.")) return
    deleteStage(selectedId)
    showToast("Etapa eliminada")
    refresh()
    setSelectedId(NEW)
  }

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-stone-700">Etapa</span>
          <select
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value={NEW}>➕ Nueva etapa</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Campos esenciales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-stone-700">Código <span className="text-red-400">*</span></span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="ET1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Nombre <span className="text-red-400">*</span></span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Excavación y fundaciones"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Estado</span>
          <select
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Toggle detalles adicionales */}
      <button
        type="button"
        onClick={() => setShowExtra(v => !v)}
        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors w-full pt-2 border-t border-stone-100"
      >
        <Chevron open={showExtra} />
        {showExtra ? "Ocultar detalles" : "Más detalles (cronograma y estimaciones)"}
      </button>

      {showExtra && (
        <div className="space-y-4">
          {/* Cronograma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-stone-700">Orden</span>
              <input
                type="number"
                className="mt-1 w-full border rounded px-2 py-1.5"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 1 })}
              />
            </label>
            <div /> {/* spacer */}
            <label className="block text-sm">
              <span className="text-stone-700">Inicio</span>
              <input
                type="date"
                className="mt-1 w-full border rounded px-2 py-1.5"
                value={form.startDate ?? ""}
                onChange={(e) => setForm({ ...form, startDate: e.target.value || undefined })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-700">Fin</span>
              <input
                type="date"
                className="mt-1 w-full border rounded px-2 py-1.5"
                value={form.endDate ?? ""}
                onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-700">Sem. Inicio</span>
              <input
                type="number"
                className="mt-1 w-full border rounded px-2 py-1.5"
                value={form.weekStart ?? ""}
                onChange={(e) => setForm({ ...form, weekStart: e.target.value ? Number(e.target.value) : undefined })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-700">Sem. Fin</span>
              <input
                type="number"
                className="mt-1 w-full border rounded px-2 py-1.5"
                value={form.weekEnd ?? ""}
                onChange={(e) => setForm({ ...form, weekEnd: e.target.value ? Number(e.target.value) : undefined })}
              />
            </label>
          </div>

          {/* Estimaciones */}
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Estimaciones</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block text-sm">
                <span className="text-stone-700">Duración estimada (días)</span>
                <input
                  type="number" min={0}
                  className="mt-1 w-full border rounded px-2 py-1.5"
                  value={form.estimatedDays ?? ""}
                  placeholder="Ej: 30"
                  onChange={(e) => setForm({ ...form, estimatedDays: e.target.value ? Number(e.target.value) : undefined })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-stone-700">Costo estimado ($)</span>
                <input
                  type="number" min={0}
                  className="mt-1 w-full border rounded px-2 py-1.5"
                  value={form.estimatedCost ?? ""}
                  placeholder="Ej: 500000"
                  onChange={(e) => setForm({ ...form, estimatedCost: e.target.value ? Number(e.target.value) : undefined })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-stone-700">Materiales requeridos</span>
                <input
                  type="number" min={0}
                  className="mt-1 w-full border rounded px-2 py-1.5"
                  value={form.materialsCount ?? ""}
                  placeholder="Ej: 12"
                  onChange={(e) => setForm({ ...form, materialsCount: e.target.value ? Number(e.target.value) : undefined })}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-clay-500 text-white rounded hover:bg-clay-600 text-sm font-medium"
        >
          {selectedId === NEW ? "Crear etapa" : "Guardar cambios"}
        </button>
        {selectedId !== NEW && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
          >
            Eliminar
          </button>
        )}
        {toast && <span className="text-sm text-stone-600">{toast}</span>}
      </div>
    </div>
  )
}
