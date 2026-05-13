"use client"

import React, { useCallback, useMemo, useState } from "react"
import { getPurchases, getStages, updatePurchaseStatus } from "@/lib/mock-db"
import { PurchaseScheduleItem } from "@/types/project"
import { LogisticaEditor } from "@/features/import/components/logistica-editor"

const STATUS_LABEL: Record<PurchaseScheduleItem["status"], string> = {
  pending:   "Pendiente",
  ordered:   "Pedido",
  delivered: "Entregado",
  critical:  "Crítico",
}

const STATUS_BADGE: Record<PurchaseScheduleItem["status"], string> = {
  pending:   "badge-pending",
  ordered:   "badge-progress",
  delivered: "badge-done",
  critical:  "badge-blocked",
}

const CURRENT_WEEK = 10 // Semana simulada actual del proyecto

export default function LogisticsPage() {
  const [mounted, setMounted]       = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm]     = useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  const allPurchases = useMemo(() => mounted ? getPurchases() : [], [refreshKey, mounted])
  const stages       = useMemo(() => mounted ? getStages()    : [], [refreshKey, mounted])
  const [purchases, setPurchases] = useState<PurchaseScheduleItem[]>([])

  React.useEffect(() => { if (mounted) setPurchases(getPurchases()) }, [refreshKey, mounted])

  const stageMap = useMemo(
    () => Object.fromEntries(stages.map((s) => [s.id, s])),
    [stages]
  )

  const critical   = purchases.filter((p) => p.status === "critical")
  const upcoming   = purchases.filter(
    (p) => p.deliveryWeek >= CURRENT_WEEK && p.deliveryWeek <= CURRENT_WEEK + 2 && p.status !== "delivered"
  )
  const allPending = purchases.filter((p) => p.status !== "delivered")

  const handleStatus = (id: string, status: PurchaseScheduleItem["status"]) => {
    updatePurchaseStatus(id, status)
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setShowForm(false)
  }, [])

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)

  if (!mounted) return null

  return (
    <div className="page-wrap space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Logística de materiales</p>
          <h1 className="page-title">Calendario de Compras</h1>
          <p className="page-subtitle">Semana actual: {CURRENT_WEEK} · Anticipación de insumos</p>
        </div>
        <button
          type="button"
          className={showForm ? "proj-btn-ghost mt-1" : "proj-btn-primary mt-1"}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancelar" : "+ Agregar compra"}
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-4">Nueva compra</h2>
          <LogisticaEditor onSaved={handleSaved} />
        </div>
      )}

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`stat-card ${critical.length > 0 ? "stat-card-accent-red" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Insumos críticos</p>
          <p className="stat-card-value">{critical.length}</p>
          <p className="stat-card-sub">Sin proveedor confirmado</p>
        </div>
        <div className="stat-card stat-card-accent-orange">
          <p className="stat-card-label">Próximas 2 semanas</p>
          <p className="stat-card-value">{upcoming.length}</p>
          <p className="stat-card-sub">Sem. {CURRENT_WEEK}–{CURRENT_WEEK + 2}</p>
        </div>
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Total a gestionar</p>
          <p className="stat-card-value">{allPending.length}</p>
          <p className="stat-card-sub">
            {fmt(allPending.reduce((s, p) => s + p.estimatedCost, 0))} estimado
          </p>
        </div>
      </div>

      {/* Insumos críticos */}
      {critical.length > 0 && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-3">Insumos Críticos — Acción Inmediata</h2>
          <div className="space-y-3">
            {critical.map((p) => (
              <PurchaseRow
                key={p.id}
                purchase={p}
                stageName={stageMap[p.stageId]?.name ?? ""}
                onStatus={handleStatus}
                fmt={fmt}
              />
            ))}
          </div>
        </div>
      )}

      {/* Próximas 2 semanas */}
      {upcoming.length > 0 && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-1">Próximas 2 Semanas</h2>
          <p className="page-subtitle mb-4">Semanas {CURRENT_WEEK}–{CURRENT_WEEK + 2}</p>
          <div className="space-y-3">
            {upcoming.map((p) => (
              <PurchaseRow
                key={p.id}
                purchase={p}
                stageName={stageMap[p.stageId]?.name ?? ""}
                onStatus={handleStatus}
                fmt={fmt}
              />
            ))}
          </div>
        </div>
      )}

      {/* Todos los pendientes */}
      <div className="card-obra p-5">
        <h2 className="section-title mb-4">Todos los Materiales Pendientes</h2>
        <div className="space-y-3">
          {allPending.length === 0 ? (
            <p className="page-subtitle">Todos los materiales han sido entregados.</p>
          ) : (
            allPending.map((p) => (
              <PurchaseRow
                key={p.id}
                purchase={p}
                stageName={stageMap[p.stageId]?.name ?? ""}
                onStatus={handleStatus}
                fmt={fmt}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function PurchaseRow({
  purchase: p,
  stageName,
  onStatus,
  fmt,
}: {
  purchase: PurchaseScheduleItem
  stageName: string
  onStatus: (id: string, s: PurchaseScheduleItem["status"]) => void
  fmt: (n: number) => string
}) {
  return (
    <div className="card-obra p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="task-title">{p.material}</p>
          <p className="task-meta">
            {p.quantity} {p.unit} · {stageName} · Entrega sem. {p.deliveryWeek}
          </p>
          {p.notes && <p className="task-meta mt-0.5">{p.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[p.status]}`}>
            {STATUS_LABEL[p.status]}
          </span>
          <span className="stage-pct">{fmt(p.estimatedCost)}</span>
        </div>
      </div>

      {/* Cambio de estado */}
      <div className="flex gap-1.5 flex-wrap">
        {(["pending", "ordered", "delivered"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStatus(p.id, s)}
            className={`status-btn ${
              p.status === s
                ? s === "pending"    ? "status-btn-pending-active"
                : s === "ordered"    ? "status-btn-progress-active"
                :                      "status-btn-done-active"
                : s === "pending"    ? "status-btn-pending"
                : s === "ordered"    ? "status-btn-progress"
                :                      "status-btn-done"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  )
}
