"use client"

import React, { useEffect, useState } from "react"
import { SupplyItem } from "@/types/stock"
import { Stage, Task } from "@/types/project"
import { addSupply, deleteSupply, getStages, getSupplies, getTasks, updateSupply } from "@/lib/mock-db"

const NEW = "__new__"

const empty = (): SupplyItem => ({
  id: "",
  stageId: "",
  name: "",
  unit: "",
  plannedQty: 0,
  realQty: 0,
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

export function StockEditor({ onSaved }: { onSaved?: () => void }) {
  const [stages, setStages]     = useState<Stage[]>([])
  const [tasks, setTasks]       = useState<Task[]>([])
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [selectedId, setSelectedId] = useState<string>(NEW)
  const [form, setForm] = useState<SupplyItem>(empty())
  const [toast, setToast] = useState("")
  const [showExtra, setShowExtra] = useState(false)

  const refresh = async () => {
    const [s, t, sup] = await Promise.all([getStages(), getTasks(), getSupplies()])
    setStages(s)
    setTasks(t)
    setSupplies(sup)
  }

  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId === NEW) {
      setForm({ ...empty(), id: `sup-${Date.now()}`, stageId: stages[0]?.id ?? "" })
    } else {
      const found = supplies.find((s) => s.id === selectedId)
      if (found) setForm({ ...found })
    }
  }, [selectedId, supplies, stages])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2200)
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim() || !form.stageId) {
      showToast("Completá etapa y nombre")
      return
    }
    if (selectedId === NEW) {
      await addSupply(form)
      showToast("Insumo creado ✓")
    } else {
      await updateSupply(form)
      showToast("Insumo actualizado ✓")
    }
    refresh()
    setSelectedId(NEW)
    onSaved?.()
  }

  const handleDelete = async (): Promise<void> => {
    if (selectedId === NEW) return
    if (!confirm("¿Eliminar insumo?")) return
    await deleteSupply(selectedId)
    showToast("Insumo eliminado")
    refresh()
    setSelectedId(NEW)
  }

  return (
    <div className="space-y-4">
      {/* Selector */}
      <label className="block text-sm">
        <span className="text-stone-700">Insumo</span>
        <select
          className="mt-1 w-full border rounded px-2 py-1.5"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value={NEW}>➕ Nuevo insumo</option>
          {supplies.map((s) => {
            const stage = stages.find((x) => x.id === s.stageId)
            return (
              <option key={s.id} value={s.id}>{stage?.code ?? "?"} — {s.name}</option>
            )
          })}
        </select>
      </label>

      {/* Campos esenciales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-stone-700">Etapa <span className="text-red-400">*</span></span>
          <select
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.stageId}
            onChange={(e) => setForm({ ...form, stageId: e.target.value, taskId: undefined })}
          >
            <option value="">Seleccionar...</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Tarea <span className="text-stone-400 font-normal">(opcional)</span></span>
          <select
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.taskId ?? ""}
            onChange={(e) => setForm({ ...form, taskId: e.target.value || undefined })}
            disabled={!form.stageId}
          >
            <option value="">— Sin tarea específica —</option>
            {tasks
              .filter((t) => t.stageId === form.stageId)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.category} · {t.title}</option>
              ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Nombre <span className="text-red-400">*</span></span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Cemento Portland"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Unidad</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            placeholder="kg, m³, unidad"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Cant. planeada</span>
          <input
            type="number"
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.plannedQty}
            onChange={(e) => setForm({ ...form, plannedQty: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      {/* Toggle costos y control */}
      <button
        type="button"
        onClick={() => setShowExtra(v => !v)}
        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors w-full pt-2 border-t border-stone-100"
      >
        <Chevron open={showExtra} />
        {showExtra ? "Ocultar detalles" : "Más detalles (costos y control de stock)"}
      </button>

      {showExtra && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-stone-700">Cant. real</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.realQty}
              onChange={(e) => setForm({ ...form, realQty: Number(e.target.value) || 0 })}
            />
          </label>
          <div /> {/* spacer */}
          <label className="block text-sm">
            <span className="text-stone-700">Costo unit. estimado</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.estimatedUnitCost ?? ""}
              onChange={(e) => setForm({ ...form, estimatedUnitCost: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Costo unit. real</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.realUnitCost ?? ""}
              onChange={(e) => setForm({ ...form, realUnitCost: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm mt-2 md:col-span-2">
            <input
              type="checkbox"
              checked={form.autoDiscountOnComplete ?? false}
              onChange={(e) => setForm({ ...form, autoDiscountOnComplete: e.target.checked })}
            />
            <span className="text-stone-700">Descontar automáticamente al completar tarea</span>
          </label>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-clay-500 text-white rounded hover:bg-clay-600 text-sm font-medium"
        >
          {selectedId === NEW ? "Crear insumo" : "Guardar cambios"}
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
