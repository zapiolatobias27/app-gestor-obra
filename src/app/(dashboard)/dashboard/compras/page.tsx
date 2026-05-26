"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  getPurchaseRequests, approvePurchaseRequest, rejectPurchaseRequest, createPurchaseRequest, updatePurchaseRequest,
  getPurchases, getStages, getTasksByStage, addPurchase, updatePurchase, updatePurchaseStatus, deletePurchase,
} from "@/lib/mock-db"
import { parseNum } from "@/lib/parseNum"
import { getActiveProject, getActiveProjectId } from "@/lib/projects-db"
import { createClient } from "@/lib/supabase/client"
import type { PurchaseRequest, PurchaseScheduleItem, Stage, Task } from "@/types/project"
import type { UserRole } from "@/types/user"
import { loadPermissionsCache, canView, canEdit } from "@/lib/permissions"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function computeCurrentWeek(startDate?: string): number {
  if (!startDate) return 1
  const ms = Date.now() - new Date(startDate).getTime()
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)) + 1)
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MainTab    = "solicitudes" | "materiales"
type ReqFilter  = "all" | "pending_approval" | "approved" | "rejected"
type MatFilter  = "all" | "critical" | "upcoming" | "pending" | "delivered"

const REQ_FILTER_LABELS: Record<ReqFilter, string> = {
  all:              "Todas",
  pending_approval: "Pendientes",
  approved:         "Aprobadas",
  rejected:         "Rechazadas",
}

const MAT_FILTER_LABELS: Record<MatFilter, string> = {
  all:       "Todas",
  critical:  "Críticas",
  upcoming:  "Próximas",
  pending:   "Pendientes",
  delivered: "Entregadas",
}

const STATUS_BADGE: Record<PurchaseRequest["status"], string> = {
  pending_approval: "badge-pending",
  approved:         "badge-done",
  rejected:         "badge-blocked",
}

const STATUS_LABEL_REQ: Record<PurchaseRequest["status"], string> = {
  pending_approval: "Pendiente",
  approved:         "Aprobada",
  rejected:         "Rechazada",
}

const STATUS_LABEL_MAT: Record<PurchaseScheduleItem["status"], string> = {
  pending:   "Pendiente",
  ordered:   "Pedido",
  delivered: "Entregado",
  critical:  "Crítico",
}

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

// ─── PurchaseForm (tab Materiales) ────────────────────────────────────────────

interface MatFormState {
  stageId: string; taskId: string; material: string; unit: string
  quantity: string; deliveryWeek: string; estimatedCost: string; realCost: string
  notes: string; status: PurchaseScheduleItem["status"]
}

function emptyMatForm(defaultStageId = ""): MatFormState {
  return { stageId: defaultStageId, taskId: "", material: "", unit: "", quantity: "", deliveryWeek: "", estimatedCost: "", realCost: "", notes: "", status: "pending" }
}

function purchaseToForm(p: PurchaseScheduleItem): MatFormState {
  return {
    stageId: p.stageId, taskId: p.taskId ?? "", material: p.material, unit: p.unit,
    quantity: p.quantity.toString(), deliveryWeek: p.deliveryWeek.toString(),
    estimatedCost: p.estimatedCost.toString(), realCost: p.realCost?.toString() ?? "",
    notes: p.notes ?? "", status: p.status,
  }
}

function PurchaseForm({ stages, initial, editingId, onSaved, onCancel }: {
  stages: Stage[]; initial: MatFormState; editingId: string | null
  onSaved: () => void; onCancel: () => void
}) {
  const [form, setForm]   = useState<MatFormState>(initial)
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const set = (patch: Partial<MatFormState>) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => { setForm(initial) }, [initial])
  useEffect(() => {
    if (!form.stageId) { setTasks([]); return }
    getTasksByStage(form.stageId).then(setTasks)
  }, [form.stageId])

  const handleSave = async () => {
    if (!form.stageId) { setError("Seleccioná una etapa."); return }
    if (!form.material.trim()) { setError("Ingresá el material."); return }
    setError(""); setSaving(true)
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
      if (editingId) { await updatePurchase(item) } else { await addPurchase(item) }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-stone-800 text-sm">{editingId ? "Editar material" : "Nuevo material"}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Etapa *</label>
          <select className="proj-form-input w-full" value={form.stageId} onChange={(e) => set({ stageId: e.target.value, taskId: "" })}>
            <option value="">Seleccionar…</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Tarea <span className="text-stone-400">(opcional)</span></label>
          <select className="proj-form-input w-full" value={form.taskId} onChange={(e) => set({ taskId: e.target.value })} disabled={!form.stageId || tasks.length === 0}>
            <option value="">— Sin tarea —</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Material *</label>
          <input type="text" className="proj-form-input w-full" placeholder="Ej: Cemento Portland" value={form.material} onChange={(e) => set({ material: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad</label>
          <input type="text" inputMode="decimal" className="proj-form-input w-full" placeholder="0" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Unidad</label>
          <input type="text" className="proj-form-input w-full" placeholder="kg, m³, bolsa…" value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Semana de entrega</label>
          <input type="number" min="1" className="proj-form-input w-full" placeholder="Ej: 5" value={form.deliveryWeek} onChange={(e) => set({ deliveryWeek: e.target.value })} />
          {form.deliveryWeek && parseInt(form.deliveryWeek) > 0 && (
            <p className="text-xs text-stone-400 mt-0.5">📅 Aparecerá en el calendario como "📦 Comprar" y "🏗️ Necesario"</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Costo estimado (ARS)</label>
          <input type="text" inputMode="decimal" className="proj-form-input w-full" placeholder="Ej: 45.000" value={form.estimatedCost} onChange={(e) => set({ estimatedCost: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Costo real (ARS)</label>
          <input type="text" inputMode="decimal" className="proj-form-input w-full" placeholder="—" value={form.realCost} onChange={(e) => set({ realCost: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Estado</label>
          <select className="proj-form-input w-full" value={form.status} onChange={(e) => set({ status: e.target.value as PurchaseScheduleItem["status"] })}>
            {(["pending", "ordered", "delivered", "critical"] as const).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL_MAT[s]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Notas</label>
        <textarea className="proj-form-input w-full resize-none" rows={2} placeholder="Observaciones opcionales…" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="proj-btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar material"}
        </button>
        <button type="button" className="proj-btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  // — Auth
  const [role, setRole]         = useState<UserRole>("supervisor")
  const [userName, setUserName] = useState("")

  // — Permissions
  const perms = loadPermissionsCache()
  const showSolicitudes = canView(perms, "compras.solicitudes")
  const showMateriales  = canView(perms, "compras.materiales")
  const canEditSolicitudes = canEdit(perms, "compras.solicitudes")
  const canEditMateriales  = canEdit(perms, "compras.materiales")

  // — Shared
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("compras:active-tab") as MainTab
      if (saved === "materiales" && !canView(loadPermissionsCache(), "compras.materiales")) return "solicitudes"
      if (saved === "solicitudes" && !canView(loadPermissionsCache(), "compras.solicitudes")) return "materiales"
      return saved ?? "solicitudes"
    }
    return "solicitudes"
  })

  // — Tab: Solicitudes
  const [requests, setRequests]       = useState<PurchaseRequest[]>([])
  const [reqFilter, setReqFilter]     = useState<ReqFilter>("all")
  const [showReqForm, setShowReqForm] = useState(false)
  const [formDesc, setFormDesc]       = useState("")
  const [formAmount, setFormAmount]   = useState("")
  const [formError, setFormError]     = useState("")
  const [submitting, setSubmitting]   = useState(false)
  const [rejectingId, setRejectingId]   = useState<string | null>(null)
  const [rejectNote, setRejectNote]     = useState("")
  const [acting, setActing]             = useState<string | null>(null)
  const [editingReqId, setEditingReqId] = useState<string | null>(null)
  const [editReqDesc, setEditReqDesc]   = useState("")
  const [editReqAmount, setEditReqAmount] = useState("")

  // — Tab: Materiales
  const [purchases, setPurchases]     = useState<PurchaseScheduleItem[]>([])
  const [stages, setStages]           = useState<Stage[]>([])
  const [currentWeek, setCurrentWeek] = useState(1)
  const [hasStartDate, setHasStartDate] = useState(true)
  const [matFilter, setMatFilter]     = useState<MatFilter>("all")
  const [showMatForm, setShowMatForm] = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<MatFormState>(emptyMatForm())

  const stageMap = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s])), [stages])
  const canApprove = role === "owner" || role === "architect"

  // ── Carga ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqs, purch, stgs, project] = await Promise.all([
        getPurchaseRequests(), getPurchases(), getStages(), getActiveProject(),
      ])
      setRequests(reqs)
      setPurchases(purch)
      setStages(stgs)
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

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
        setUserName(profile?.name ?? "")
        const pid = getActiveProjectId()
        if (pid) {
          const { data: member } = await supabase
            .from("project_members").select("role").eq("project_id", pid).eq("user_id", user.id).single()
          if (member?.role) setRole(member.role as UserRole)
        }
      }
      load()
    }
    init()
  }, [load])

  const switchTab = (tab: MainTab) => {
    setActiveTab(tab)
    localStorage.setItem("compras:active-tab", tab)
    setShowReqForm(false)
    setShowMatForm(false)
    setEditingId(null)
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const pending      = requests.filter((r) => r.status === "pending_approval")
  const approved     = requests.filter((r) => r.status === "approved")
  const rejected     = requests.filter((r) => r.status === "rejected")
  const totalApproved = approved.reduce((s, r) => s + r.amount, 0)

  const critical     = purchases.filter((p) => p.status === "critical")
  const upcoming     = purchases.filter(
    (p) => p.deliveryWeek >= currentWeek && p.deliveryWeek <= currentWeek + 2 && p.status !== "delivered" && p.status !== "critical"
  )

  // ── Acciones: Solicitudes ──────────────────────────────────────────────────

  const handleApprove = async (id: string) => {
    setActing(id)
    try {
      await approvePurchaseRequest(id, userName)
      window.dispatchEvent(new CustomEvent("purchase-request-resolved"))
      await load()
    } finally { setActing(null) }
  }

  const handleReject = async (id: string) => {
    setActing(id)
    try {
      await rejectPurchaseRequest(id, userName, rejectNote.trim() || undefined)
      window.dispatchEvent(new CustomEvent("purchase-request-resolved"))
      setRejectingId(null); setRejectNote("")
      await load()
    } finally { setActing(null) }
  }

  const handleSaveEditReq = async (id: string) => {
    const parsed = parseNum(editReqAmount)
    if (!editReqDesc.trim() || parsed <= 0) return
    setActing(id)
    await updatePurchaseRequest(id, editReqDesc.trim(), parsed)
    setEditingReqId(null)
    await load()
    setActing(null)
  }

  const handleSubmitReq = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formDesc.trim()) { setFormError("Ingresá una descripción."); return }
    const amt = parseNum(formAmount)
    if (!formAmount || amt <= 0) { setFormError("Ingresá un monto válido."); return }
    setSubmitting(true); setFormError("")
    try {
      await createPurchaseRequest(formDesc.trim(), amt, userName)
      setFormDesc(""); setFormAmount(""); setShowReqForm(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear la solicitud")
    } finally { setSubmitting(false) }
  }

  const filteredReqs =
    reqFilter === "all"              ? requests :
    reqFilter === "pending_approval" ? pending :
    reqFilter === "approved"         ? approved : rejected

  // ── Acciones: Materiales ───────────────────────────────────────────────────

  const classifyMat = (p: PurchaseScheduleItem): "critical" | "upcoming" | "other" => {
    if (p.status === "critical") return "critical"
    if (p.deliveryWeek >= currentWeek && p.deliveryWeek <= currentWeek + 2 && p.status !== "delivered") return "upcoming"
    return "other"
  }

  const filteredMat = useMemo(() => {
    switch (matFilter) {
      case "critical":  return purchases.filter((p) => p.status === "critical")
      case "upcoming":  return purchases.filter((p) => p.deliveryWeek >= currentWeek && p.deliveryWeek <= currentWeek + 2 && p.status !== "delivered")
      case "pending":   return purchases.filter((p) => p.status === "pending" || p.status === "ordered")
      case "delivered": return purchases.filter((p) => p.status === "delivered")
      default:          return purchases
    }
  }, [purchases, matFilter, currentWeek])

  const handleStatusChange = async (id: string, status: PurchaseScheduleItem["status"]) => {
    await updatePurchaseStatus(id, status)
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }

  const handleDeleteMat = async (p: PurchaseScheduleItem) => {
    if (!confirm(`¿Eliminar "${p.material}"?`)) return
    await deletePurchase(p.id)
    setPurchases((prev) => prev.filter((x) => x.id !== p.id))
  }

  const openNewMat = () => {
    setEditingId(null)
    setFormInitial(emptyMatForm(stages[0]?.id ?? ""))
    setShowMatForm(true)
  }

  const openEditMat = (p: PurchaseScheduleItem) => {
    setEditingId(p.id)
    setFormInitial(purchaseToForm(p))
    setShowMatForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-wrap space-y-6">

      {/* Header */}
      <div>
        <p className="page-eyebrow">Gestión económica</p>
        <h1 className="page-title">Compras y Materiales</h1>
        <p className="page-subtitle">
          Solicitudes de autorización ·{" "}
          {hasStartDate ? `Semana actual: ${currentWeek}` : "Configurá la fecha de inicio para ver la semana"}
        </p>
      </div>

      {/* KPIs combinados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card stat-card-accent-orange">
          <p className="stat-card-label">Solicitudes pendientes</p>
          <p className="stat-card-value">{pending.length}</p>
          <p className="stat-card-sub">{pending.length === 1 ? "solicitud" : "solicitudes"}</p>
        </div>
        <div className="stat-card stat-card-accent-green">
          <p className="stat-card-label">Total aprobado</p>
          <p className="stat-card-value">{fmt(totalApproved)}</p>
          <p className="stat-card-sub">{approved.length} {approved.length === 1 ? "orden" : "órdenes"}</p>
        </div>
        <div className={`stat-card ${critical.length > 0 ? "stat-card-accent-red" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Materiales críticos</p>
          <p className="stat-card-value">{critical.length}</p>
          <p className="stat-card-sub">Sin proveedor confirmado</p>
        </div>
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Próximas 2 semanas</p>
          <p className="stat-card-value">{upcoming.length}</p>
          <p className="stat-card-sub">Sem. {currentWeek}–{currentWeek + 2}</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-stone-200">
        {showSolicitudes && (
          <button
            type="button"
            onClick={() => switchTab("solicitudes")}
            className={[
              "px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px",
              activeTab === "solicitudes"
                ? "border-stone-800 text-stone-900"
                : "border-transparent text-stone-400 hover:text-stone-600",
            ].join(" ")}
          >
            Solicitudes
            {pending.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-xs leading-none">
                {pending.length}
              </span>
            )}
          </button>
        )}
        {showMateriales && (
          <button
            type="button"
            onClick={() => switchTab("materiales")}
            className={[
              "px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px",
              activeTab === "materiales"
                ? "border-stone-800 text-stone-900"
                : "border-transparent text-stone-400 hover:text-stone-600",
            ].join(" ")}
          >
            Materiales
            {critical.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-xs leading-none">
                {critical.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Tab: Solicitudes ──────────────────────────────────────────────── */}
      {activeTab === "solicitudes" && (
        <div className="card-obra p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Solicitudes de compra</h2>
            {!showReqForm && canEditSolicitudes && (
              <button type="button" className="proj-btn-primary" onClick={() => setShowReqForm(true)}>
                + Nueva solicitud
              </button>
            )}
          </div>

          {showReqForm && (
            <form onSubmit={handleSubmitReq} className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-stone-800 text-sm">Nueva solicitud de compra</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Descripción *</label>
                  <input type="text" className="proj-form-input w-full" placeholder="Ej: Cemento Portland 50 bolsas" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Monto (ARS) *</label>
                  <input type="text" inputMode="decimal" className="proj-form-input w-full" placeholder="Ej: 50.000" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                </div>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-2">
                <button type="submit" className="proj-btn-primary" disabled={submitting}>
                  {submitting ? "Enviando…" : "Enviar solicitud"}
                </button>
                <button type="button" className="proj-btn-ghost" disabled={submitting}
                  onClick={() => { setShowReqForm(false); setFormDesc(""); setFormAmount(""); setFormError("") }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Filtros solicitudes */}
          <div className="flex gap-1 border-b border-stone-100 pb-3 flex-wrap">
            {(Object.keys(REQ_FILTER_LABELS) as ReqFilter[]).map((f) => (
              <button key={f} type="button" onClick={() => setReqFilter(f)}
                className={["px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  reqFilter === f ? "bg-stone-800 text-white" : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                ].join(" ")}
              >
                {REQ_FILTER_LABELS[f]}
                {f === "pending_approval" && pending.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-xs leading-none">
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tabla solicitudes */}
          {loading ? (
            <p className="text-sm text-stone-400">Cargando…</p>
          ) : filteredReqs.length === 0 ? (
            <p className="text-sm text-stone-400">No hay solicitudes en esta categoría.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-stone-100">
                    <th className="pb-2 pr-4 font-medium text-stone-500">Descripción</th>
                    <th className="pb-2 pr-4 font-medium text-stone-500">Solicitado por</th>
                    <th className="pb-2 pr-4 font-medium text-stone-500">Fecha</th>
                    <th className="pb-2 pr-4 font-medium text-stone-500 text-right">Monto</th>
                    <th className="pb-2 pr-4 font-medium text-stone-500">Estado</th>
                    <th className="pb-2 font-medium text-stone-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReqs.map((req) => (
                    <React.Fragment key={req.id}>
                      <tr className="border-b border-stone-50 hover:bg-stone-50">
                        <td className="py-2 pr-4 font-medium text-stone-800 max-w-[200px]">{req.description}</td>
                        <td className="py-2 pr-4 text-stone-500">{req.requestedBy}</td>
                        <td className="py-2 pr-4 text-stone-500 whitespace-nowrap tabular-nums">{fmtDate(req.requestedAt)}</td>
                        <td className="py-2 pr-4 text-stone-800 font-medium text-right tabular-nums">{fmt(req.amount)}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[req.status]}`}>
                            {STATUS_LABEL_REQ[req.status]}
                          </span>
                          {req.status !== "pending_approval" && req.reviewedBy && (
                            <p className="text-xs text-stone-400 mt-0.5">
                              por {req.reviewedBy}{req.reviewedAt ? ` · ${fmtDate(req.reviewedAt)}` : ""}
                            </p>
                          )}
                          {req.status === "rejected" && req.rejectionNote && (
                            <p className="text-xs text-stone-400 mt-0.5 italic">"{req.rejectionNote}"</p>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            {canApprove && req.status === "pending_approval" && (
                              <>
                                <button type="button" className="proj-btn-primary" style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
                                  disabled={acting === req.id} onClick={() => handleApprove(req.id)}>
                                  Aprobar
                                </button>
                                <button type="button" className="proj-btn-danger-sm" disabled={acting === req.id}
                                  onClick={() => { setRejectingId(req.id); setRejectNote(""); setEditingReqId(null) }}>
                                  Rechazar
                                </button>
                              </>
                            )}
                            <button type="button" className="proj-btn-ghost-sm"
                              onClick={() => {
                                setEditingReqId(req.id)
                                setEditReqDesc(req.description)
                                setEditReqAmount(req.amount.toString())
                                setRejectingId(null)
                                setRejectNote("")
                              }}>
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                      {rejectingId === req.id && (
                        <tr className="bg-stone-50">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input type="text" className="proj-form-input flex-1 min-w-[200px]"
                                placeholder="Nota de rechazo (opcional)…" value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)} autoFocus />
                              <button type="button" className="proj-btn-danger-sm" disabled={acting === req.id}
                                onClick={() => handleReject(req.id)}>
                                {acting === req.id ? "Rechazando…" : "Confirmar rechazo"}
                              </button>
                              <button type="button" className="proj-btn-ghost-sm"
                                onClick={() => { setRejectingId(null); setRejectNote("") }}>
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {editingReqId === req.id && (
                        <tr className="bg-stone-50">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input type="text" className="proj-form-input flex-1 min-w-[200px]"
                                placeholder="Descripción *" value={editReqDesc}
                                onChange={(e) => setEditReqDesc(e.target.value)} autoFocus />
                              <input type="text" inputMode="decimal" className="proj-form-input w-32"
                                placeholder="Monto *" value={editReqAmount}
                                onChange={(e) => setEditReqAmount(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditReq(req.id) }} />
                              <button type="button" className="proj-btn-primary"
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
                                disabled={acting === req.id}
                                onClick={() => handleSaveEditReq(req.id)}>
                                {acting === req.id ? "Guardando…" : "Guardar"}
                              </button>
                              <button type="button" className="proj-btn-ghost-sm"
                                onClick={() => setEditingReqId(null)}>
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Materiales ───────────────────────────────────────────────── */}
      {activeTab === "materiales" && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-stone-500">
              Materiales planificados vinculados a etapas y tareas. Los que tienen semana de entrega aparecen en el calendario.
            </p>
            {!showMatForm && canEditMateriales && (
              <button type="button" className="proj-btn-primary shrink-0" onClick={openNewMat}>
                + Agregar material
              </button>
            )}
          </div>

          {showMatForm && (
            <PurchaseForm
              stages={stages}
              initial={formInitial}
              editingId={editingId}
              onSaved={() => { setShowMatForm(false); setEditingId(null); load() }}
              onCancel={() => { setShowMatForm(false); setEditingId(null) }}
            />
          )}

          <div className="card-obra p-5">
            {/* Filtros materiales */}
            <div className="flex gap-1 mb-4 border-b border-stone-100 pb-3 flex-wrap">
              {(Object.keys(MAT_FILTER_LABELS) as MatFilter[]).map((f) => {
                const count = f === "critical" ? critical.length : f === "upcoming" ? upcoming.length : undefined
                return (
                  <button key={f} type="button" onClick={() => setMatFilter(f)}
                    className={["px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      matFilter === f ? "bg-stone-800 text-white" : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                    ].join(" ")}
                  >
                    {MAT_FILTER_LABELS[f]}
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
            ) : filteredMat.length === 0 ? (
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
                    {filteredMat.map((p) => {
                      const cls   = classifyMat(p)
                      const rowBg = cls !== "other" ? ROW_URGENT[cls] : ""
                      const stage = stageMap[p.stageId]
                      return (
                        <tr key={p.id} className={`border-b border-stone-50 hover:bg-stone-50 ${rowBg}`}>
                          <td className="py-2 pr-3 font-medium text-stone-800">
                            {p.material}
                            {p.notes && <p className="text-xs text-stone-400 font-normal">{p.notes}</p>}
                          </td>
                          <td className="py-2 pr-3 text-stone-500 text-xs">
                            {stage ? `${stage.code} ${stage.name}` : "—"}
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
                            {p.realCost != null
                              ? <span className="text-stone-800 font-medium">{fmt(p.realCost)}</span>
                              : <span className="text-stone-300">—</span>
                            }
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              value={p.status}
                              onChange={(e) => handleStatusChange(p.id, e.target.value as PurchaseScheduleItem["status"])}
                              className={`text-xs font-medium rounded-md border px-2 py-1 cursor-pointer ${STATUS_SELECT_CLS[p.status]}`}
                            >
                              {(["pending", "ordered", "delivered", "critical"] as const).map((s) => (
                                <option key={s} value={s}>{STATUS_LABEL_MAT[s]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <button type="button" className="proj-btn-ghost-sm" onClick={() => openEditMat(p)}>Editar</button>
                              <button type="button" className="proj-btn-danger-sm" onClick={() => handleDeleteMat(p)}>Eliminar</button>
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
      )}
    </div>
  )
}
