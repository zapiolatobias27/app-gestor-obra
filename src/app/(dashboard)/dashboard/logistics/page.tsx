"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  getPurchases, getStages, getTasksByStage,
  addPurchase, updatePurchase, updatePurchaseStatus, deletePurchase,
} from "@/lib/mock-db"
import { getActiveProject } from "@/lib/projects-db"
import { parseNum } from "@/lib/parseNum"
import type { PurchaseScheduleItem, Stage, Task } from "@/types/project"

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = "all" | "critical" | "upcoming" | "pending" | "delivered"

const FILTER_LABELS: Record<Filter, string> = {
  all:       "Todas",
  critical:  "Críticas",
  upcoming:  "Próximas",
  pending:   "Pendientes",
  delivered: "Entregadas",
}

const STATUS_LABEL: Record<PurchaseScheduleItem["status"], string> = {
  pending:   "Pendiente",
  ordered:   "Pedido",
  delivered: "Entregado",
  critical:  "Crítico",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n)
}

function computeCurrentWeek(startDate?: string): number {
  if (!startDate) return 1
  const ms = Date.now() - new Date(startDate).getTime()
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)) + 1)
}

// ─── Empty form ───────────────────────────────────────────────────────────────

interface FormState {
  stageId: string
  taskId: string
  material: string
  unit: string
  quantity: string
  deliveryWeek: string
  estimatedCost: string
  realCost: string
  notes: string
  status: PurchaseScheduleItem["status"]
}

function emptyForm(defaultStageId = ""): FormState {
  return {
    stageId: defaultStageId,
    taskId: "",
    material: "",
    unit: "",
    quantity: "",
    deliveryWeek: "",
    estimatedCost: "",
    realCost: "",
    notes: "",
    status: "pending",
  }
}

function purchaseToForm(p: PurchaseScheduleItem): FormState {
  return {
    stageId:       p.stageId,
    taskId:        p.taskId ?? "",
    material:      p.material,
    unit:          p.unit,
    quantity:      p.quantity.toString(),
    deliveryWeek:  p.deliveryWeek.toString(),
    estimatedCost: p.estimatedCost.toString(),
    realCost:      p.realCost?.toString() ?? "",
    notes:         p.notes ?? "",
    status:        p.status,
  }
}

// ─── Inline form component ────────────────────────────────────────────────────

function PurchaseForm({
  stages,
  initial,
  editingId,
  onSaved,
  onCancel,
}: {
  stages: Stage[]
  initial: FormState
  editingId: string | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm]       = useState<FormState>(initial)
  const [tasks, setTasks]     = useState<Task[]>([])
  const [error, setError]     = useState("")
  const [saving, setSaving]   = useState(false)

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    setForm(initial)
  }, [initial])

  useEffect(() => {
    if (!form.stageId) { setTasks([]); return }
    getTasksByStage(form.stageId).then(setTasks)
  }, [form.stageId])

  const handleSave = async () => {
    if (!form.stageId) { setError("Seleccioná una etapa."); return }
    if (!form.material.trim()) { setError("Ingresá el material."); return }
    setError("")
    setSaving(true)
    try {
      const item: PurchaseScheduleItem = {
        id:            editingId ?? `pc-${Date.now()}`,
        stageId:       form.stageId,
        taskId:        form.taskId || undefined,
        material:      form.material.trim(),
        unit:          form.unit.trim(),
        quantity:      parseNum(form.quantity),
        deliveryWeek:  parseInt(form.deliveryWeek) || 0,
        status:        form.status,
        estimatedCost: parseNum(form.estimatedCost),
        realCost:      form.realCost ? parseNum(form.realCost) : undefined,
        notes:         form.notes.trim() || undefined,
      }
      if (editingId) {
        await updatePurchase(item)
      } else {
        await addPurchase(item)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-stone-800 text-sm">
        {editingId ? "Editar compra" : "Nueva compra"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Etapa */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Etapa *</label>
          <select
            className="proj-form-input w-full"
            value={form.stageId}
            onChange={(e) => set({ stageId: e.target.value, taskId: "" })}
          >
            <option value="">Seleccionar…</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </div>

        {/* Tarea (opcional) */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Tarea <span className="text-stone-400">(opcional)</span>
          </label>
          <select
            className="proj-form-input w-full"
            value={form.taskId}
            onChange={(e) => set({ taskId: e.target.value })}
            disabled={!form.stageId || tasks.length === 0}
          >
            <option value="">— Sin tarea —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        {/* Material */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Material *</label>
          <input
            type="text"
            className="proj-form-input w-full"
            placeholder="Ej: Cemento Portland"
            value={form.material}
            onChange={(e) => set({ material: e.target.value })}
          />
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad</label>
          <input
            type="text"
            inputMode="decimal"
            className="proj-form-input w-full"
            placeholder="0"
            value={form.quantity}
            onChange={(e) => set({ quantity: e.target.value })}
          />
        </div>

        {/* Unidad */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Unidad</label>
          <input
            type="text"
            className="proj-form-input w-full"
            placeholder="kg, m³, bolsa…"
            value={form.unit}
            onChange={(e) => set({ unit: e.target.value })}
          />
        </div>

        {/* Semana de entrega */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Semana de entrega</label>
          <input
            type="number"
            min="1"
            className="proj-form-input w-full"
            placeholder="Ej: 5"
            value={form.deliveryWeek}
            onChange={(e) => set({ deliveryWeek: e.target.value })}
          />
          {form.deliveryWeek && parseInt(form.deliveryWeek) > 0 && (
            <p className="text-xs text-stone-400 mt-0.5">
              📅 Aparecerá en el calendario como "📦 Comprar" y "🏗️ Necesario"
            </p>
          )}
        </div>

        {/* Costo estimado */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Costo estimado (ARS)</label>
          <input
            type="text"
            inputMode="decimal"
            className="proj-form-input w-full"
            placeholder="Ej: 45.000"
            value={form.estimatedCost}
            onChange={(e) => set({ estimatedCost: e.target.value })}
          />
        </div>

        {/* Costo real */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Costo real (ARS)</label>
          <input
            type="text"
            inputMode="decimal"
            className="proj-form-input w-full"
            placeholder="—"
            value={form.realCost}
            onChange={(e) => set({ realCost: e.target.value })}
          />
        </div>

        {/* Estado */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Estado</label>
          <select
            className="proj-form-input w-full"
            value={form.status}
            onChange={(e) => set({ status: e.target.value as PurchaseScheduleItem["status"] })}
          >
            {(["pending", "ordered", "delivered", "critical"] as const).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Notas</label>
        <textarea
          className="proj-form-input w-full resize-none"
          rows={2}
          placeholder="Observaciones opcionales…"
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="button" className="proj-btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar compra"}
        </button>
        <button type="button" className="proj-btn-ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_SELECT_CLS: Record<PurchaseScheduleItem["status"], string> = {
  pending:   "text-amber-700 bg-amber-50 border-amber-200",
  ordered:   "text-blue-700 bg-blue-50 border-blue-200",
  delivered: "text-green-700 bg-green-50 border-green-200",
  critical:  "text-red-700 bg-red-50 border-red-200",
}

const ROW_URGENT: Record<string, string> = {
  critical: "bg-red-50/40",
  upcoming: "bg-orange-50/40",
}

export default function LogisticsPage() {
  const [purchases, setPurchases]     = useState<PurchaseScheduleItem[]>([])
  const [stages, setStages]           = useState<Stage[]>([])
  const [currentWeek, setCurrentWeek] = useState(1)
  const [hasStartDate, setHasStartDate] = useState(true)
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<Filter>("all")
  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<FormState>(emptyForm())

  const stageMap = useMemo(
    () => Object.fromEntries(stages.map((s) => [s.id, s])),
    [stages]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, s, project] = await Promise.all([getPurchases(), getStages(), getActiveProject()])
      setPurchases(p)
      setStages(s)
      if (project?.startDate) {
        setCurrentWeek(computeCurrentWeek(project.startDate))
        setHasStartDate(true)
      } else {
        setCurrentWeek(1)
        setHasStartDate(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Classify each purchase for highlighting
  const classify = (p: PurchaseScheduleItem): "critical" | "upcoming" | "other" => {
    if (p.status === "critical") return "critical"
    if (p.deliveryWeek >= currentWeek && p.deliveryWeek <= currentWeek + 2 && p.status !== "delivered") return "upcoming"
    return "other"
  }

  const critical  = purchases.filter((p) => p.status === "critical")
  const upcoming  = purchases.filter(
    (p) => p.deliveryWeek >= currentWeek && p.deliveryWeek <= currentWeek + 2 && p.status !== "delivered" && p.status !== "critical"
  )
  const allPending = purchases.filter((p) => p.status !== "delivered")

  const filtered = useMemo(() => {
    switch (filter) {
      case "critical":  return purchases.filter((p) => p.status === "critical")
      case "upcoming":  return purchases.filter(
        (p) => p.deliveryWeek >= currentWeek && p.deliveryWeek <= currentWeek + 2 && p.status !== "delivered"
      )
      case "pending":   return purchases.filter((p) => p.status === "pending" || p.status === "ordered")
      case "delivered": return purchases.filter((p) => p.status === "delivered")
      default:          return purchases
    }
  }, [purchases, filter, currentWeek])

  const handleStatusChange = async (id: string, status: PurchaseScheduleItem["status"]) => {
    await updatePurchaseStatus(id, status)
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }

  const handleDelete = async (p: PurchaseScheduleItem) => {
    if (!confirm(`¿Eliminar "${p.material}"?`)) return
    await deletePurchase(p.id)
    setPurchases((prev) => prev.filter((x) => x.id !== p.id))
  }

  const openNew = () => {
    setEditingId(null)
    setFormInitial(emptyForm(stages[0]?.id ?? ""))
    setShowForm(true)
  }

  const openEdit = (p: PurchaseScheduleItem) => {
    setEditingId(p.id)
    setFormInitial(purchaseToForm(p))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSaved = () => {
    setShowForm(false)
    setEditingId(null)
    load()
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const totalEstimated = allPending.reduce((s, p) => s + p.estimatedCost, 0)

  return (
    <div className="page-wrap space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Logística de materiales</p>
          <h1 className="page-title">Calendario de Compras</h1>
          <p className="page-subtitle">
            {hasStartDate
              ? `Semana actual: ${currentWeek} · Los materiales con semana de entrega aparecen en el calendario`
              : "Configurá la fecha de inicio del proyecto para ver la semana actual"}
          </p>
        </div>
        {!showForm && (
          <button type="button" className="proj-btn-primary mt-1" onClick={openNew}>
            + Agregar compra
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <PurchaseForm
          stages={stages}
          initial={formInitial}
          editingId={editingId}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`stat-card ${critical.length > 0 ? "stat-card-accent-red" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Insumos críticos</p>
          <p className="stat-card-value">{critical.length}</p>
          <p className="stat-card-sub">Sin proveedor confirmado</p>
        </div>
        <div className="stat-card stat-card-accent-orange">
          <p className="stat-card-label">Próximas 2 semanas</p>
          <p className="stat-card-value">{upcoming.length}</p>
          <p className="stat-card-sub">Sem. {currentWeek}–{currentWeek + 2}</p>
        </div>
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Total a gestionar</p>
          <p className="stat-card-value">{allPending.length}</p>
          <p className="stat-card-sub">{fmt(totalEstimated)} estimado</p>
        </div>
      </div>

      {/* Table */}
      <div className="card-obra p-5">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 border-b border-stone-100 pb-3 flex-wrap">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => {
            const count =
              f === "critical" ? critical.length :
              f === "upcoming" ? upcoming.length : undefined
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  filter === f
                    ? "bg-stone-800 text-white"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-100",
                ].join(" ")}
              >
                {FILTER_LABELS[f]}
                {count != null && count > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-xs leading-none ${f === "critical" ? "bg-red-500" : "bg-orange-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-stone-400">No hay materiales en esta categoría.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-stone-100">
                  <th className="pb-2 pr-3 font-medium text-stone-500">Material</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500">Etapa / Tarea</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500 text-right">Cant.</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500 text-center">Sem.</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500 text-right">Estimado</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500 text-right">Real</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500">Estado</th>
                  <th className="pb-2 font-medium text-stone-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const cls = classify(p)
                  const rowBg = cls !== "other" ? ROW_URGENT[cls] : ""
                  const stage = stageMap[p.stageId]
                  return (
                    <tr key={p.id} className={`border-b border-stone-50 hover:bg-stone-50 ${rowBg}`}>
                      <td className="py-2 pr-3 font-medium text-stone-800">
                        {p.material}
                        {p.notes && (
                          <p className="text-xs text-stone-400 font-normal">{p.notes}</p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-stone-500 text-xs">
                        <span>{stage ? `${stage.code} ${stage.name}` : "—"}</span>
                      </td>
                      <td className="py-2 pr-3 text-stone-600 text-right tabular-nums">
                        {p.quantity > 0 ? `${p.quantity} ${p.unit}` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-stone-500 text-center tabular-nums">
                        {p.deliveryWeek > 0 ? p.deliveryWeek : "—"}
                      </td>
                      <td className="py-2 pr-3 text-stone-600 text-right tabular-nums">
                        {p.estimatedCost > 0 ? fmt(p.estimatedCost) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {p.realCost != null ? (
                          <span className="text-stone-800 font-medium">{fmt(p.realCost)}</span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={p.status}
                          onChange={(e) => handleStatusChange(p.id, e.target.value as PurchaseScheduleItem["status"])}
                          className={`text-xs font-medium rounded-md border px-2 py-1 cursor-pointer ${STATUS_SELECT_CLS[p.status]}`}
                        >
                          {(["pending", "ordered", "delivered", "critical"] as const).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="proj-btn-ghost-sm"
                            onClick={() => openEdit(p)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="proj-btn-danger-sm"
                            onClick={() => handleDelete(p)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
