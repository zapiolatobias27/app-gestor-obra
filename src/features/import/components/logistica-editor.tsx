"use client"

import React, { useEffect, useState } from "react"
import { PurchaseScheduleItem, Stage } from "@/types/project"
import { addPurchase, deletePurchase, getPurchases, getStages, updatePurchase } from "@/lib/mock-db"

const NEW = "__new__"
const STATUSES: PurchaseScheduleItem["status"][] = ["pending", "ordered", "delivered", "critical"]
const STATUS_LABEL: Record<PurchaseScheduleItem["status"], string> = {
  pending:   "Pendiente",
  ordered:   "Ordenado",
  delivered: "Entregado",
  critical:  "Crítico",
}

const empty = (): PurchaseScheduleItem => ({
  id: "",
  stageId: "",
  material: "",
  unit: "",
  quantity: 0,
  deliveryWeek: 1,
  status: "pending",
  estimatedCost: 0,
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

export function LogisticaEditor({ onSaved }: { onSaved?: () => void }) {
  const [stages, setStages]       = useState<Stage[]>([])
  const [purchases, setPurchases] = useState<PurchaseScheduleItem[]>([])
  const [selectedId, setSelectedId] = useState<string>(NEW)
  const [form, setForm] = useState<PurchaseScheduleItem>(empty())
  const [toast, setToast] = useState("")
  const [showExtra, setShowExtra] = useState(false)

  const refresh = () => {
    setStages(getStages())
    setPurchases(getPurchases())
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (selectedId === NEW) {
      setForm({ ...empty(), id: `pc-${Date.now()}`, stageId: stages[0]?.id ?? "" })
    } else {
      const found = purchases.find((p) => p.id === selectedId)
      if (found) setForm({ ...found })
    }
  }, [selectedId, purchases, stages])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2200)
  }

  const handleSave = (): void => {
    if (!form.material.trim() || !form.stageId) {
      showToast("Completá etapa y material")
      return
    }
    if (selectedId === NEW) {
      addPurchase(form)
      showToast("Compra creada ✓")
    } else {
      updatePurchase(form)
      showToast("Compra actualizada ✓")
    }
    refresh()
    setSelectedId(NEW)
    onSaved?.()
  }

  const handleDelete = (): void => {
    if (selectedId === NEW) return
    if (!confirm("¿Eliminar compra?")) return
    deletePurchase(selectedId)
    showToast("Compra eliminada")
    refresh()
    setSelectedId(NEW)
  }

  return (
    <div className="space-y-4">
      {/* Selector */}
      <label className="block text-sm">
        <span className="text-stone-700">Compra</span>
        <select
          className="mt-1 w-full border rounded px-2 py-1.5"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value={NEW}>➕ Nueva compra</option>
          {purchases.map((p) => {
            const stage = stages.find((x) => x.id === p.stageId)
            return (
              <option key={p.id} value={p.id}>
                {stage?.code ?? "?"} — {p.material} (sem {p.deliveryWeek})
              </option>
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
            onChange={(e) => setForm({ ...form, stageId: e.target.value })}
          >
            <option value="">Seleccionar...</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Material <span className="text-red-400">*</span></span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
            placeholder="Ej: Cemento Portland"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Cantidad</span>
          <input
            type="number"
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Semana de entrega</span>
          <input
            type="number"
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.deliveryWeek}
            onChange={(e) => setForm({ ...form, deliveryWeek: Number(e.target.value) || 1 })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">Estado</span>
          <select
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as PurchaseScheduleItem["status"] })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Toggle costos y notas */}
      <button
        type="button"
        onClick={() => setShowExtra(v => !v)}
        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors w-full pt-2 border-t border-stone-100"
      >
        <Chevron open={showExtra} />
        {showExtra ? "Ocultar detalles" : "Más detalles (unidad, costos y notas)"}
      </button>

      {showExtra && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-stone-700">Unidad</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="kg, m³, bolsa"
            />
          </label>
          <div /> {/* spacer */}
          <label className="block text-sm">
            <span className="text-stone-700">Costo estimado ($)</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.estimatedCost}
              onChange={(e) => setForm({ ...form, estimatedCost: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Costo real ($)</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.realCost ?? ""}
              onChange={(e) => setForm({ ...form, realCost: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-stone-700">Notas</span>
            <textarea
              className="mt-1 w-full border rounded px-2 py-1.5"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value || undefined })}
            />
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
          {selectedId === NEW ? "Crear compra" : "Guardar cambios"}
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
