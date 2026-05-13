"use client"

import React, { useState } from "react"
import { SupplyItem } from "@/types/stock"
import { Stage, Task } from "@/types/project"
import { checkDeviation, formatDeviation, getDeviationSeverity } from "@/features/stock/logic/deviation-check"
import { updateSupplyRealQty, updateSupplyCurrentStock } from "@/lib/mock-db"

interface StockTableProps {
  supplies: SupplyItem[]
  stages?: Stage[]
  tasks?: Task[]
  onUpdate?: () => void
}

const SEVERITY_ROW: Record<"low" | "medium" | "high", string> = {
  low:    "",
  medium: "stock-row-medium",
  high:   "stock-row-high",
}

const SEVERITY_BADGE: Record<"low" | "medium" | "high", string> = {
  low:    "",
  medium: "badge-pending",
  high:   "badge-blocked",
}

export function StockTable({ supplies, stages = [], tasks = [], onUpdate }: StockTableProps) {
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editValue, setEditValue]         = useState<number>(0)
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [editStockValue, setEditStockValue] = useState<number>(0)

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.code]))
  const taskMap  = Object.fromEntries(tasks.map((t)  => [t.id, t.title]))

  const startEdit = (id: string, val: number) => { setEditingId(id); setEditValue(val) }
  const saveEdit  = (id: string) => { updateSupplyRealQty(id, editValue); setEditingId(null); onUpdate?.() }

  const startStockEdit = (id: string, val: number) => { setEditingStockId(id); setEditStockValue(val) }
  const saveStockEdit  = (id: string) => { updateSupplyCurrentStock(id, editStockValue); setEditingStockId(null); onUpdate?.() }

  return (
    <div className="card-obra overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="stock-thead">
            <tr>
              <th className="stock-th text-left">Insumo</th>
              <th className="stock-th text-left hidden md:table-cell">Etapa / Tarea</th>
              <th className="stock-th text-left hidden sm:table-cell">Unidad</th>
              <th className="stock-th text-right">Planif.</th>
              <th className="stock-th text-right">Real</th>
              <th className="stock-th text-right hidden lg:table-cell">Stock actual</th>
              <th className="stock-th text-right">Desvío</th>
              <th className="stock-th text-center hidden md:table-cell">Sev.</th>
            </tr>
          </thead>
          <tbody className="stock-tbody">
            {supplies.map((supply) => {
              const alert    = checkDeviation(supply)
              const severity = alert ? getDeviationSeverity(alert.deviationPct) : "low"
              const pct      = alert ? alert.deviationPct : 0
              const stageName = stageMap[supply.stageId] ?? ""
              const taskName  = supply.taskId ? (taskMap[supply.taskId] ?? "") : ""

              return (
                <tr key={supply.id} className={`stock-row ${SEVERITY_ROW[severity]}`}>
                  <td className="stock-td font-semibold">{supply.name}</td>
                  <td className="stock-td hidden md:table-cell">
                    <span className="stock-stage-pill">{stageName}</span>
                    {taskName && <span className="stock-task-label">{taskName}</span>}
                  </td>
                  <td className="stock-td text-stone-500 hidden sm:table-cell">{supply.unit}</td>
                  <td className="stock-td text-right tabular-nums">{supply.plannedQty}</td>
                  <td className="stock-td text-right">
                    {editingId === supply.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                        onBlur={() => saveEdit(supply.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(supply.id) }}
                        className="stock-edit-input"
                        aria-label={`Editar cantidad real de ${supply.name}`}
                        autoFocus
                      />
                    ) : (
                      <button type="button" onClick={() => startEdit(supply.id, supply.realQty)} className="stock-edit-btn" title="Clic para editar">
                        {supply.realQty || "—"}
                      </button>
                    )}
                  </td>
                  <td className="stock-td text-right hidden lg:table-cell">
                    {editingStockId === supply.id ? (
                      <input
                        type="number"
                        value={editStockValue}
                        onChange={(e) => setEditStockValue(parseFloat(e.target.value) || 0)}
                        onBlur={() => saveStockEdit(supply.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveStockEdit(supply.id) }}
                        className="stock-edit-input"
                        aria-label={`Editar stock actual de ${supply.name}`}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startStockEdit(supply.id, supply.currentStock ?? 0)}
                        className={`stock-edit-btn ${
                          supply.currentStock === 0 ? "stock-val-empty" :
                          supply.currentStock != null && supply.plannedQty > 0 && supply.currentStock <= supply.plannedQty * 0.2
                            ? "stock-val-low" : ""
                        }`}
                        title="Clic para editar stock actual"
                      >
                        {supply.currentStock != null ? supply.currentStock : "—"}
                      </button>
                    )}
                  </td>
                  <td className={`stock-td text-right font-bold tabular-nums ${
                    alert && pct > 0 && severity === "high"   ? "stock-dev-high" :
                    alert && pct > 0 && severity === "medium" ? "stock-dev-medium" :
                    alert && pct < 0                          ? "stock-dev-saving" :
                    supply.realQty > 0                        ? "stock-dev-ok" : "stock-dev-none"
                  }`}>
                    {alert
                      ? formatDeviation(pct)
                      : supply.realQty > 0
                        ? `Usado: ${supply.realQty}`
                        : "—"
                    }
                  </td>
                  <td className="stock-td text-center hidden md:table-cell">
                    {alert && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        pct < 0 ? "badge-saving" : SEVERITY_BADGE[severity]
                      }`}>
                        {pct < 0 ? "Ahorro" : severity === "high" ? "Alto" : "Medio"}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
