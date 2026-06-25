"use client"

import React, { useEffect, useState } from "react"
import { Package, Pencil } from "lucide-react"
import { getSuppliesByStage, updateSupplyOrderWeek } from "@/lib/mock-db"
import type { SupplyItem } from "@/types/stock"

interface StageMaterialsSectionProps {
  stageId: string
}

const STATUS_LABEL: Record<NonNullable<SupplyItem["purchaseStatus"]>, string> = {
  pending:   "Por comprar",
  ordered:   "Pedido",
  delivered: "Comprado",
  critical:  "Crítico",
}

const STATUS_BADGE: Record<NonNullable<SupplyItem["purchaseStatus"]>, string> = {
  pending:   "badge-pending",
  ordered:   "badge-progress",
  delivered: "badge-done",
  critical:  "badge-blocked",
}

const fmtQty = (n: number) => new Intl.NumberFormat("es-AR").format(n)

// Celda editable de semana de pedido del material → actualiza el calendario en vivo.
function WeekCell({ supply, onSaved }: { supply: SupplyItem; onSaved: (week: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(supply.orderWeek != null ? String(supply.orderWeek) : "")
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(false)

  const save = async () => {
    const trimmed = value.trim()
    const week = trimmed === "" ? null : Math.max(1, parseInt(trimmed) || 0)
    if ((week ?? null) === (supply.orderWeek ?? null)) { setEditing(false); return }
    setSaving(true)
    setError(false)
    try {
      await updateSupplyOrderWeek(supply.id, week)
      onSaved(week)
      setEditing(false)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <input
        type="number"
        min={1}
        className={`proj-form-input w-16 text-right py-1 ${error ? "border-red-400" : ""}`}
        value={value}
        autoFocus
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") { setValue(supply.orderWeek != null ? String(supply.orderWeek) : ""); setEditing(false) }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 tabular-nums text-stone-500 hover:text-clay-600 transition-colors"
      onClick={() => setEditing(true)}
      title="Editar semana de pedido"
    >
      {supply.orderWeek != null ? supply.orderWeek : "—"}
      <Pencil size={12} className="opacity-50" />
    </button>
  )
}

export function StageMaterialsSection({ stageId }: StageMaterialsSectionProps) {
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    getSuppliesByStage(stageId)
      .then(setSupplies)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [stageId])

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-stone-400 text-sm">Cargando materiales...</div>
    )
  }

  if (supplies.length === 0) return null

  const updateWeek = (id: string, week: number | null) =>
    setSupplies((prev) => prev.map((s) => (s.id === id ? { ...s, orderWeek: week ?? undefined } : s)))

  return (
    <div className="card-obra p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Package size={18} className="text-clay-500" />
        <h3 className="section-title">Materiales de la etapa ({supplies.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-400 border-b border-sand-200">
              <th className="py-2 pr-3 font-medium">Material</th>
              <th className="py-2 px-3 font-medium text-right">Cantidad</th>
              <th className="py-2 px-3 font-medium">Unidad</th>
              <th className="py-2 px-3 font-medium text-right">Sem.</th>
              <th className="py-2 pl-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {supplies.map((s) => (
              <tr key={s.id}>
                <td className="py-2 pr-3 text-stone-800">{s.name}</td>
                <td className="py-2 px-3 text-right tabular-nums text-stone-700">
                  {s.plannedQty > 0 ? fmtQty(s.plannedQty) : "—"}
                </td>
                <td className="py-2 px-3 text-stone-500">{s.unit || "—"}</td>
                <td className="py-2 px-3 text-right">
                  <WeekCell supply={s} onSaved={(week) => updateWeek(s.id, week)} />
                </td>
                <td className="py-2 pl-3">
                  {s.purchaseStatus ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[s.purchaseStatus]}`}>
                      {STATUS_LABEL[s.purchaseStatus]}
                    </span>
                  ) : (
                    <span className="text-stone-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        Tocá la semana para editarla. Cambia la fecha del material en el calendario.
      </p>
    </div>
  )
}
