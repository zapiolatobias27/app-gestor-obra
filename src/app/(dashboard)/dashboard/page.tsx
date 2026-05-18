"use client"

import React, { useMemo, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  getProject,
  getStages,
  getTasks,
  getAlerts,
  getCriticalPurchases,
  getDailyBudgetEntries,
  upsertDailyBudgetEntry,
  getRecentResolvedRequests,
  createPurchaseRequest,
  getBudgetMovements,
  getProjectStageSummary,
} from "@/lib/mock-db"
import { TaskStatus, UserRole, PurchaseRequest, BudgetMovement } from "@/types/project"
import { getActiveProjectId } from "@/lib/projects-db"

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En Proceso",
  completed: "Completada",
  blocked: "Bloqueada",
}

const STAGE_DOT: Record<TaskStatus, string> = {
  pending:    "stage-dot-pending",
  in_progress:"stage-dot-progress",
  completed:  "stage-dot-done",
  blocked:    "stage-dot-blocked",
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

// ─── Caja Diaria ────────────────────────────────────────────────────────────

interface DailyCashBoxProps {
  role: UserRole
  tick: number
}

function DailyCashBox({ role, tick }: DailyCashBoxProps) {
  const today = todayISO()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [savedAmount, setSavedAmount] = useState<number | null>(null)
  const [savedNote, setSavedNote] = useState("")

  useEffect(() => {
    async function load() {
      const entries = await getDailyBudgetEntries()
      const entry = entries.find((e) => e.date === today)
      if (entry) { setSavedAmount(entry.amount); setSavedNote(entry.note ?? "") }
      else { setSavedAmount(null); setSavedNote("") }
    }
    load()
  }, [today, tick])

  const canEdit = role === "owner" || role === "architect"

  const handleSave = useCallback(async () => {
    const parsed = parseFloat(amount.replace(/\./g, "").replace(",", "."))
    if (isNaN(parsed)) return
    await upsertDailyBudgetEntry({ date: today, amount: parsed, note: note.trim() || undefined })
    setSavedAmount(parsed)
    setSavedNote(note.trim())
    setEditing(false)
  }, [amount, note, today])

  return (
    <div className="daily-box">
      <div className="daily-box-header">
        <span className="daily-box-title">Caja diaria</span>
        <span className="daily-box-date">{fmtDate(today)}</span>
      </div>

      {editing ? (
        <div className="daily-input-wrap">
          <input
            className="daily-input"
            type="number"
            placeholder="Monto disponible ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <input
            className="daily-input daily-note-input"
            type="text"
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
          />
          <button type="button" className="daily-save-btn" onClick={handleSave}>
            Guardar
          </button>
        </div>
      ) : (
        <>
          <p className="daily-amount-display">
            {savedAmount !== null ? fmt(savedAmount) : "—"}
          </p>
          <p className="daily-note-display">{savedNote || (savedAmount === null ? "Sin registro para hoy" : "")}</p>
          {canEdit && (
            <button
              type="button"
              className="daily-edit-btn"
              onClick={() => {
                setAmount(savedAmount !== null ? String(savedAmount) : "")
                setNote(savedNote)
                setEditing(true)
              }}
            >
              {savedAmount !== null ? "Editar" : "Registrar monto"}
            </button>
          )}
          {!canEdit && <p className="daily-readonly-label">Solo lectura</p>}
        </>
      )}
    </div>
  )
}

// ─── Notificaciones de resolución ───────────────────────────────────────────

interface PurchaseNotificationsProps {
  requests: PurchaseRequest[]
}

function PurchaseNotifications({ requests }: PurchaseNotificationsProps) {
  if (requests.length === 0) return null

  return (
    <div className="daily-box">
      <div className="notif-box notif-box-flush">
        <p className="notif-title">📋 Historial de solicitudes de compra</p>
        {requests.map((r) => {
          const approved = r.status === "approved"
          return (
            <div key={r.id} className="notif-item">
              <div className="notif-item-info">
                <p className="notif-item-desc">{r.description}</p>
                <p className="notif-item-meta">
                  Solicitado por <strong>{r.requestedBy}</strong> · {fmtDateTime(r.requestedAt)}
                </p>
                {r.reviewedBy && r.reviewedAt && (
                  <p className={approved ? "notif-resolved-approved" : "notif-resolved-rejected"}>
                    {approved ? "✅ Aprobado" : "❌ Rechazado"} por <strong>{r.reviewedBy}</strong> · {fmtDateTime(r.reviewedAt)}
                    {r.rejectionNote && ` — ${r.rejectionNote}`}
                  </p>
                )}
              </div>
              <span className="notif-item-amount">{fmt(r.amount)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Movimientos de presupuesto ──────────────────────────────────────────────

interface BudgetMovementsProps {
  movements: BudgetMovement[]
}

function BudgetMovements({ movements }: BudgetMovementsProps) {
  if (movements.length === 0) return null

  return (
    <div className="movements-box">
      <p className="movements-title">Movimientos recientes</p>
      {movements.slice(0, 10).map((m) => (
        <div key={m.id} className="movement-item">
          <span className="movement-desc">{m.description}</span>
          <span className="movement-date">{fmtDateTime(m.date)}</span>
          <span className="movement-amount">{fmt(m.amount)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Modal solicitud de compra ───────────────────────────────────────────────

interface PurchaseRequestModalProps {
  userName: string
  onCreated: () => void
  onClose: () => void
}

function PurchaseRequestModal({ userName, onCreated, onClose }: PurchaseRequestModalProps) {
  const [desc, setDesc] = useState("")
  const [amount, setAmount] = useState("")

  const handleSend = useCallback(async () => {
    const parsed = parseFloat(amount.replace(/\./g, "").replace(",", "."))
    if (!desc.trim() || isNaN(parsed) || parsed <= 0) return
    await createPurchaseRequest(desc.trim(), parsed, userName)
    onCreated()
    onClose()
  }, [desc, amount, userName, onCreated, onClose])

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="section-title mb-1">Nueva solicitud de compra</h2>
        <p className="text-sm text-stone-500">La solicitud será enviada para aprobación.</p>
        <input
          className="daily-input daily-note-input"
          type="text"
          placeholder="Descripción (ej: Cemento Portland 50 bolsas)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          autoFocus
        />
        <input
          className="daily-input"
          type="number"
          placeholder="Monto ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend() }}
        />
        <div className="flex gap-2">
          <button type="button" className="daily-save-btn flex-1" onClick={handleSend}>
            Enviar solicitud
          </button>
          <button type="button" className="daily-edit-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sección colapsable ──────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string
  storageKey: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({ title, storageKey, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) setOpen(saved === "true")
  }, [storageKey])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(storageKey, String(next))
      return next
    })
  }, [storageKey])

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between py-2 px-1 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">
          {title}
        </span>
        <svg
          className={`w-4 h-4 text-stone-400 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div className="space-y-4 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole]                   = useState<UserRole>("supervisor")
  const [userName, setUserName]           = useState("Usuario")
  const [tick, setTick]                   = useState(0)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [project, setProject]             = useState<import("@/types/project").Project | null>(null)
  const [stages, setStages]               = useState<import("@/types/project").Stage[]>([])
  const [tasks, setTasks]                 = useState<import("@/types/project").Task[]>([])
  const [alerts, setAlerts]               = useState<import("@/types/stock").AuditAlert[]>([])
  const [criticalPurchases, setCritical]  = useState<import("@/types/project").PurchaseScheduleItem[]>([])
  const [resolvedRequests, setResolved]   = useState<import("@/types/project").PurchaseRequest[]>([])
  const [movements, setMovements]         = useState<import("@/types/project").BudgetMovement[]>([])
  const [stageSummary, setStageSummary]   = useState<import("@/lib/mock-db").ProjectStageSummary | null>(null)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    async function load() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
        setUserName(profile?.name ?? "Usuario")
        const pid = getActiveProjectId()
        if (pid) {
          const { data: member } = await supabase
            .from("project_members")
            .select("role")
            .eq("user_id", user.id)
            .eq("project_id", pid)
            .single()
          setRole((member?.role as UserRole) ?? "supervisor")
        }
      }
      const proj = await getProject()
      if (!proj) {
        setProject(null)
        return
      }

      // Calcular presupuesto real: facturas pagadas + solicitudes de compra aprobadas
      const pid = getActiveProjectId()
      if (pid) {
        const [{ data: invoices }, { data: approvedReqs }] = await Promise.all([
          supabase.from("invoices").select("amount").eq("project_id", pid).eq("status", "paid"),
          supabase.from("purchase_requests").select("amount").eq("project_id", pid).eq("status", "approved"),
        ])
        const paidTotal     = (invoices ?? []).reduce((sum, inv) => sum + ((inv.amount as number) ?? 0), 0)
        const approvedTotal = (approvedReqs ?? []).reduce((sum, r)  => sum + ((r.amount  as number) ?? 0), 0)
        proj.budgetReal = paidTotal + approvedTotal
      }

      const [stgs, tsks, alts, crit, res, movs, summary] = await Promise.all([
        getStages(),
        getTasks(),
        getAlerts(),
        getCriticalPurchases(),
        getRecentResolvedRequests(),
        getBudgetMovements(),
        getProjectStageSummary(),
      ])
      setProject(proj)
      setStages(stgs)
      setTasks(tsks)
      setAlerts(alts)
      setCritical(crit)
      setResolved(res)
      setMovements(movs)
      setStageSummary(summary)
    }
    load()
  }, [tick])

  // Refresh when the notification bell approves/rejects a request
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener("purchase-request-resolved", handler)
    return () => window.removeEventListener("purchase-request-resolved", handler)
  }, [refresh])

  if (!project) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <div className="text-6xl mb-6">🏗️</div>
        <h1 className="text-3xl font-bold text-stone-900 mb-2">
          Bienvenido, {userName || "usuario"}
        </h1>
        <p className="text-stone-500 text-lg mb-8">Comencemos</p>
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-2 px-6 py-3 bg-clay-500 hover:bg-clay-600 text-white font-semibold rounded-lg text-base transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Crear mi primer proyecto
        </Link>
      </div>
    )
  }

  const completedStages = stages.filter((s) => s.status === "completed").length
  const totalTasks      = tasks.length
  const completedTasks  = tasks.filter((t) => t.status === "completed").length
  const blockedTasks    = tasks.filter((t) => t.status === "blocked").length
  const activeAlerts    = alerts.filter((a) => a.status === "active").length
  const overallPct      = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const budgetPct       = project.budgetEstimated > 0
    ? Math.round((project.budgetReal / project.budgetEstimated) * 100) : 0

  const stageRows = stages.map((s) => {
    const st   = tasks.filter((t) => t.stageId === s.id)
    const done = st.filter((t) => t.status === "completed").length
    return { ...s, taskCount: st.length, done, pct: st.length > 0 ? Math.round((done / st.length) * 100) : 0 }
  })

  const currentStage = stages.find((s) => s.status === "in_progress" || s.status === "blocked")
  const hasWarnings  = activeAlerts > 0 || criticalPurchases.length > 0 || blockedTasks > 0



  return (
    <div className="page-wrap space-y-6">

      {/* Encabezado */}
      <div className="flex flex-col gap-1">
        <p className="page-eyebrow">Proyecto activo</p>
        <h1 className="page-title">{project.name}</h1>
        <p className="page-subtitle">{project.address} · Cliente: {project.client}</p>
      </div>

      {/* Banner de alertas */}
      {hasWarnings && (
        <div className="alert-banner">
          <span className="font-bold">Atención:</span>
          {blockedTasks > 0 && (
            <span>{blockedTasks} tarea{blockedTasks > 1 ? "s" : ""} bloqueada{blockedTasks > 1 ? "s" : ""}</span>
          )}
          {activeAlerts > 0 && (
            <span>{activeAlerts} alerta{activeAlerts > 1 ? "s" : ""} de stock activa{activeAlerts > 1 ? "s" : ""}</span>
          )}
          {criticalPurchases.length > 0 && (
            <span>{criticalPurchases.length} insumo{criticalPurchases.length > 1 ? "s" : ""} sin stock</span>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Avance general</p>
          <p className="stat-card-value">{overallPct}%</p>
          <p className="stat-card-sub">{completedTasks} de {totalTasks} tareas</p>
        </div>
        <div className="stat-card stat-card-accent-green">
          <p className="stat-card-label">Etapas completadas</p>
          <p className="stat-card-value">{completedStages}/{stages.length}</p>
          <p className="stat-card-sub">{stageSummary ? `${stageSummary.stageCompletionPct}% de la obra` : currentStage ? `Actual: ${currentStage.code}` : "Todas completas"}</p>
        </div>
        <div className="stat-card stat-card-accent-orange">
          <p className="stat-card-label">Presupuesto ejecutado</p>
          <p className="stat-card-value">{budgetPct}%</p>
          <p className="stat-card-sub">{fmt(project.budgetReal)}</p>
        </div>
        <div className={`stat-card ${activeAlerts > 0 ? "stat-card-accent-red" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Alertas activas</p>
          <p className="stat-card-value">{activeAlerts + criticalPurchases.length}</p>
          <p className="stat-card-sub">{blockedTasks} bloqueada{blockedTasks !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* ── Resumen de la obra ──────────────────────────────────────────── */}
      <CollapsibleSection title="Resumen de la obra" storageKey="dash:section:resumen">
        {stageSummary && stageSummary.stagesWithEstimates > 0 && (
          <div className="card-obra p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Estimaciones de obra</h2>
              <Link href="/dashboard/import" className="link-pill">Editar estimaciones →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="obra-summary-card">
                <p className="obra-summary-icon">📅</p>
                <p className="obra-summary-value">
                  {stageSummary.totalEstimatedDays > 0
                    ? `${stageSummary.totalEstimatedDays} días`
                    : "—"}
                </p>
                <p className="obra-summary-label">Duración total estimada</p>
                {stageSummary.totalEstimatedDays > 0 && (
                  <p className="obra-summary-sub">
                    ≈ {Math.round(stageSummary.totalEstimatedDays / 30)} meses
                  </p>
                )}
              </div>
              <div className="obra-summary-card">
                <p className="obra-summary-icon">💰</p>
                <p className="obra-summary-value">
                  {stageSummary.totalEstimatedCost > 0
                    ? fmt(stageSummary.totalEstimatedCost)
                    : "—"}
                </p>
                <p className="obra-summary-label">Presupuesto total por etapas</p>
                {stageSummary.totalEstimatedCost > 0 && project.budgetEstimated > 0 && (
                  <p className="obra-summary-sub">
                    {Math.round((stageSummary.totalEstimatedCost / project.budgetEstimated) * 100)}% del presupuesto global
                  </p>
                )}
              </div>
              <div className="obra-summary-card">
                <p className="obra-summary-icon">🧱</p>
                <p className="obra-summary-value">
                  {stageSummary.totalMaterials > 0
                    ? stageSummary.totalMaterials
                    : "—"}
                </p>
                <p className="obra-summary-label">Materiales totales estimados</p>
                <p className="obra-summary-sub">
                  {stageSummary.stagesWithEstimates} de {stageSummary.totalStages} etapas con datos
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-stone-600 font-medium">Porcentaje de obra completado</span>
                <span className="text-sm font-bold text-stone-800">{stageSummary.stageCompletionPct}%</span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${stageSummary.stageCompletionPct === 100 ? "progress-fill-done" : ""}`}
                  ref={(el) => { if (el) el.style.width = `${stageSummary.stageCompletionPct}%` }}
                />
              </div>
              <p className="text-xs text-stone-400 mt-1">
                {stageSummary.completedStages} de {stageSummary.totalStages} etapas terminadas
              </p>
            </div>
          </div>
        )}

        <div className="card-obra p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Presupuesto — Real vs. Estimado</h2>
            <span className={budgetPct > 90 ? "budget-badge-bad" : "budget-badge-ok"}>
              {budgetPct}% ejecutado
            </span>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${budgetPct > 90 ? "progress-fill-danger" : ""}`}
              ref={(el) => { if (el) el.style.width = `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          <div className="budget-row">
            <span>Real: {fmt(project.budgetReal)}</span>
            <span>Estimado: {fmt(project.budgetEstimated)}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Etapas ──────────────────────────────────────────────────────── */}
      <CollapsibleSection title="Etapas" storageKey="dash:section:etapas">
        <div className="card-obra p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Planilla de etapas</h2>
            <Link href="/dashboard/stages" className="link-pill">Ver planilla →</Link>
          </div>
          <div className="space-y-3">
            {stageRows.map((s) => (
              <Link key={s.id} href={`/dashboard/stages/${s.id}`} className="block group">
                <div className="flex items-center gap-3">
                  <span className="stage-code">{s.code}</span>
                  <span className={STAGE_DOT[s.status]} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <p className="stage-name truncate group-hover:underline">{s.name}</p>
                      <span className="stage-pct">{s.pct}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${s.status === "completed" ? "progress-fill-done" : ""}`}
                        ref={(el) => { if (el) el.style.width = `${s.pct}%` }}
                      />
                    </div>
                    {(s.estimatedDays != null || s.estimatedCost != null || s.materialsCount != null) && (
                      <div className="stage-estimates">
                        {s.estimatedDays != null && (
                          <span className="stage-estimate-pill">📅 {s.estimatedDays}d</span>
                        )}
                        {s.estimatedCost != null && (
                          <span className="stage-estimate-pill">💰 {fmt(s.estimatedCost)}</span>
                        )}
                        {s.materialsCount != null && (
                          <span className="stage-estimate-pill">🧱 {s.materialsCount} mat.</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="stage-status hidden sm:block">{STATUS_LABEL[s.status]}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {criticalPurchases.length > 0 && (
          <div className="card-obra p-5">
            <h2 className="section-title mb-3">Insumos Críticos</h2>
            <div className="space-y-2">
              {criticalPurchases.map((p) => (
                <div key={p.id} className="critical-item">
                  <span className="critical-icon">⚠</span>
                  <div>
                    <p className="critical-title">{p.material}</p>
                    {p.notes && <p className="critical-note">{p.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/logistics" className="link-pill mt-3">Ver Logística →</Link>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Finanzas ────────────────────────────────────────────────────── */}
      <CollapsibleSection title="Finanzas" storageKey="dash:section:finanzas">
        {movements.length > 0 && (
          <div className="daily-box">
            <BudgetMovements movements={movements} />
          </div>
        )}
        <DailyCashBox role={role} tick={tick} />
        {resolvedRequests.length > 0 && (
          <PurchaseNotifications requests={resolvedRequests} />
        )}
      </CollapsibleSection>

      {/* ── FAB solicitar compra (solo supervisor) ───────────────────────── */}
      {role === "supervisor" && (
        <button
          type="button"
          className="purchase-fab"
          onClick={() => setShowPurchaseModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Solicitar compra
        </button>
      )}

      {/* ── Modal solicitud de compra ────────────────────────────────────── */}
      {showPurchaseModal && (
        <PurchaseRequestModal
          userName={userName}
          onCreated={refresh}
          onClose={() => setShowPurchaseModal(false)}
        />
      )}

    </div>
  )
}
