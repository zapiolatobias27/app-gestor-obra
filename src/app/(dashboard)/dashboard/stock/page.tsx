"use client"

import React, { useEffect, useMemo, useState } from "react"
import { getSupplies, getStages, getTasks, addSupply } from "@/lib/mock-db"
import { checkAllDeviations, formatDeviation } from "@/features/stock/logic/deviation-check"
import { StockTable } from "@/features/stock/components/stock-table"
import { Stage, Task } from "@/types/project"
import type { SupplyItem } from "@/types/stock"

// ─── Formulario agregar insumo ─────────────────────────────────────────────

function AddSupplyForm({ onAdded }: { onAdded: () => void }) {
  const [stages, setStages] = useState<Stage[]>([])
  const [tasks, setTasks]   = useState<Task[]>([])

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([getStages(), getTasks()])
      setStages(s)
      setTasks(t)
    }
    load()
  }, [])

  const [stageId, setStageId] = useState("")
  const [taskId,  setTaskId]  = useState("")
  const [name,    setName]    = useState("")
  const [unit,    setUnit]    = useState("")
  const [qty,     setQty]     = useState("")
  const [stock,   setStock]   = useState("")
  const [error,   setError]   = useState("")

  const stageTasks = stageId
    ? tasks.filter((t) => t.stageId === stageId)
    : []

  const handleStageChange = (id: string) => {
    setStageId(id)
    setTaskId("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stageId)     { setError("Seleccioná una etapa."); return }
    if (!name.trim()) { setError("Ingresá el nombre del material."); return }
    if (!unit.trim()) { setError("Ingresá la unidad."); return }
    await addSupply({
      id: `sup-${Date.now()}`,
      stageId,
      taskId: taskId || undefined,
      name: name.trim(),
      unit: unit.trim(),
      plannedQty: parseFloat(qty) || 0,
      realQty: 0,
      currentStock: parseFloat(stock) || undefined,
    })
    setName(""); setUnit(""); setQty(""); setStock(""); setError("")
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="proj-form-error">{error}</p>}

      {/* Etapa */}
      <div className="proj-form-field">
        <label className="proj-form-label" htmlFor="sup-stage">Etapa *</label>
        <select
          id="sup-stage"
          className="proj-form-input"
          value={stageId}
          onChange={(e) => handleStageChange(e.target.value)}
        >
          <option value="">— Seleccioná una etapa —</option>
          {stages.map((s: Stage) => (
            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
          ))}
        </select>
      </div>

      {/* Tarea (opcional, aparece al elegir etapa) */}
      {stageId && (
        <div className="proj-form-field">
          <label className="proj-form-label" htmlFor="sup-task">
            Tarea <span className="text-stone-400 font-normal">(opcional)</span>
          </label>
          {stageTasks.length > 0 ? (
            <select
              id="sup-task"
              className="proj-form-input"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">— Sin tarea específica —</option>
              {stageTasks.map((t: Task) => (
                <option key={t.id} value={t.id}>{t.category} · {t.title}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-stone-400 mt-1">Esta etapa no tiene tareas creadas aún</p>
          )}
        </div>
      )}

      {/* Datos del material */}
      <div className="grid grid-cols-2 gap-3">
        <div className="proj-form-field col-span-2">
          <label className="proj-form-label" htmlFor="sup-name">Material *</label>
          <input
            id="sup-name"
            className="proj-form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cemento Portland"
          />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label" htmlFor="sup-unit">Unidad *</label>
          <input
            id="sup-unit"
            className="proj-form-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="bolsa, m³, kg…"
          />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label" htmlFor="sup-qty">Cantidad planificada</label>
          <input
            id="sup-qty"
            type="number"
            min={0}
            className="proj-form-input"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="proj-form-field col-span-2">
          <label className="proj-form-label" htmlFor="sup-stock">
            Stock actual disponible <span className="text-stone-400 font-normal">(opcional)</span>
          </label>
          <input
            id="sup-stock"
            type="number"
            min={0}
            className="proj-form-input"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Unidades que hay hoy en obra"
          />
        </div>
      </div>

      <button type="submit" className="proj-btn-primary">Agregar material</button>
    </form>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [refreshKey, setRefreshKey]   = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)
  const [supplies, setSupplies]       = useState<SupplyItem[]>([])
  const [stages, setStages]           = useState<Stage[]>([])
  const [allTasks, setAllTasks]       = useState<Task[]>([])

  useEffect(() => {
    async function load() {
      const [s, st, t] = await Promise.all([getSupplies(), getStages(), getTasks()])
      setSupplies(s)
      setStages(st)
      setAllTasks(t)
    }
    load()
  }, [refreshKey])

  const deviations = useMemo(() => checkAllDeviations(supplies), [supplies])

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]))

  const highAlerts   = deviations.filter((a) => a.severity === "high")
  const mediumAlerts = deviations.filter((a) => a.severity === "medium")

  const refresh = () => {
    setRefreshKey((k) => k + 1)
    setShowAddForm(false)
  }

  return (
    <div className="page-wrap space-y-6">
      <div>
        <p className="page-eyebrow">Control de inventario</p>
        <h1 className="page-title">Stock y Auditoría</h1>
        <p className="page-subtitle">
          Consumos reales vs. teóricos · Desvíos alertados al superar el 5%
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`stat-card ${highAlerts.length > 0 ? "stat-card-accent-red" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Desvíos altos</p>
          <p className="stat-card-value">{highAlerts.length}</p>
          <p className="stat-card-sub">Más del 15% de desvío</p>
        </div>
        <div className={`stat-card ${mediumAlerts.length > 0 ? "stat-card-accent-orange" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Desvíos medios</p>
          <p className="stat-card-value">{mediumAlerts.length}</p>
          <p className="stat-card-sub">Entre 5% y 15%</p>
        </div>
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Insumos registrados</p>
          <p className="stat-card-value">{supplies.length}</p>
          <p className="stat-card-sub">{supplies.filter((s) => s.realQty > 0).length} con consumo real</p>
        </div>
      </div>

      {/* Alertas activas */}
      {deviations.length > 0 && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-3">Alertas de Desvío Activas</h2>
          <div className="space-y-2">
            {deviations.map((alert) => (
              <div
                key={alert.id}
                className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm
                  ${alert.severity === "high" ? "stock-row-high badge-blocked" : "stock-row-medium badge-pending"}`}
              >
                <div>
                  <p className="font-semibold">{alert.supplyName}</p>
                  <p className="text-xs mt-0.5 opacity-75">
                    {stageMap[alert.stageId] ?? alert.stageId} · Teórico: {alert.plannedQty} → Real: {alert.realQty}
                  </p>
                </div>
                <span className="font-bold tabular-nums text-base">
                  {formatDeviation(alert.deviationPct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agregar insumo */}
      <div className="card-obra p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Agregar material</h2>
          <button
            type="button"
            className={showAddForm ? "proj-btn-ghost-sm" : "proj-btn-primary"}
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? "Cancelar" : "+ Nuevo material"}
          </button>
        </div>
        {showAddForm && <AddSupplyForm onAdded={refresh} />}
        {!showAddForm && (
          <p className="text-sm text-stone-400">
            Seleccioná etapa y tarea para agregar un material directamente al inventario.
          </p>
        )}
      </div>

      {/* Tabla */}
      <div className="space-y-2">
        <h2 className="section-title px-1">Insumos Registrados</h2>
        <p className="page-subtitle px-1 mb-3">
          Toca el stock real para editar. Los desvíos ≥5% se resaltan automáticamente.
        </p>
        <StockTable
          key={refreshKey}
          supplies={supplies}
          stages={stages}
          tasks={allTasks}
          onUpdate={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </div>
  )
}
