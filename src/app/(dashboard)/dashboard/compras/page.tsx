"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  getPurchaseRequests,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  createPurchaseRequest,
} from "@/lib/mock-db"
import { parseNum } from "@/lib/parseNum"
import { getActiveProjectId } from "@/lib/projects-db"
import { createClient } from "@/lib/supabase/client"
import type { PurchaseRequest } from "@/types/project"
import type { UserRole } from "@/types/user"

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

type Filter = "all" | "pending_approval" | "approved" | "rejected"

const FILTER_LABELS: Record<Filter, string> = {
  all:              "Todas",
  pending_approval: "Pendientes",
  approved:         "Aprobadas",
  rejected:         "Rechazadas",
}

const STATUS_BADGE: Record<PurchaseRequest["status"], string> = {
  pending_approval: "badge-pending",
  approved:         "badge-done",
  rejected:         "badge-blocked",
}

const STATUS_LABEL: Record<PurchaseRequest["status"], string> = {
  pending_approval: "Pendiente",
  approved:         "Aprobada",
  rejected:         "Rechazada",
}

export default function ComprasPage() {
  const [requests, setRequests]       = useState<PurchaseRequest[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<Filter>("all")
  const [userName, setUserName]       = useState("")
  const [role, setRole]               = useState<UserRole>("supervisor")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote]   = useState("")
  const [acting, setActing]           = useState<string | null>(null)

  const [showForm, setShowForm]       = useState(false)
  const [formDesc, setFormDesc]       = useState("")
  const [formAmount, setFormAmount]   = useState("")
  const [formError, setFormError]     = useState("")
  const [submitting, setSubmitting]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRequests(await getPurchaseRequests())
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
            .from("project_members")
            .select("role")
            .eq("project_id", pid)
            .eq("user_id", user.id)
            .single()
          if (member?.role) setRole(member.role as UserRole)
        }
      }
      load()
    }
    init()
  }, [load])

  const canApprove = role === "owner" || role === "architect"

  const handleApprove = async (id: string) => {
    setActing(id)
    try {
      await approvePurchaseRequest(id, userName)
      window.dispatchEvent(new CustomEvent("purchase-request-resolved"))
      await load()
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (id: string) => {
    setActing(id)
    try {
      await rejectPurchaseRequest(id, userName, rejectNote.trim() || undefined)
      window.dispatchEvent(new CustomEvent("purchase-request-resolved"))
      setRejectingId(null)
      setRejectNote("")
      await load()
    } finally {
      setActing(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formDesc.trim()) { setFormError("Ingresá una descripción."); return }
    const amt = parseNum(formAmount)
    if (!formAmount || amt <= 0) { setFormError("Ingresá un monto válido."); return }
    setSubmitting(true)
    setFormError("")
    try {
      await createPurchaseRequest(formDesc.trim(), amt, userName)
      setFormDesc("")
      setFormAmount("")
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear la solicitud")
    } finally {
      setSubmitting(false)
    }
  }

  const pending       = requests.filter((r) => r.status === "pending_approval")
  const approved      = requests.filter((r) => r.status === "approved")
  const rejected      = requests.filter((r) => r.status === "rejected")
  const totalApproved = approved.reduce((s, r) => s + r.amount, 0)

  const filtered =
    filter === "all"              ? requests :
    filter === "pending_approval" ? pending :
    filter === "approved"         ? approved :
                                    rejected

  return (
    <div className="page-wrap space-y-6">
      <div>
        <p className="page-eyebrow">Gestión económica</p>
        <h1 className="page-title">Compras</h1>
        <p className="page-subtitle">Registro de solicitudes de compra del proyecto.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="stat-card stat-card-accent-orange">
          <p className="stat-card-label">Pendientes</p>
          <p className="stat-card-value">{pending.length}</p>
          <p className="stat-card-sub">{pending.length === 1 ? "solicitud" : "solicitudes"}</p>
        </div>
        <div className="stat-card stat-card-accent-green">
          <p className="stat-card-label">Aprobadas</p>
          <p className="stat-card-value">{fmt(totalApproved)}</p>
          <p className="stat-card-sub">{approved.length} {approved.length === 1 ? "orden" : "órdenes"}</p>
        </div>
        <div className="stat-card stat-card-accent-red">
          <p className="stat-card-label">Rechazadas</p>
          <p className="stat-card-value">{rejected.length}</p>
          <p className="stat-card-sub">{rejected.length === 1 ? "solicitud" : "solicitudes"}</p>
        </div>
      </div>

      <div className="card-obra p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Solicitudes</h2>
          {!showForm && (
            <button type="button" className="proj-btn-primary" onClick={() => setShowForm(true)}>
              + Nueva solicitud
            </button>
          )}
        </div>

        {/* New request form — visible to all roles */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3"
          >
            <h3 className="font-semibold text-stone-800 text-sm">Nueva solicitud de compra</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Descripción *</label>
                <input
                  type="text"
                  className="proj-form-input w-full"
                  placeholder="Ej: Cemento Portland 50 bolsas"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Monto (ARS) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="proj-form-input w-full"
                  placeholder="Ej: 50.000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="proj-btn-primary" disabled={submitting}>
                {submitting ? "Enviando…" : "Enviar solicitud"}
              </button>
              <button
                type="button"
                className="proj-btn-ghost"
                disabled={submitting}
                onClick={() => { setShowForm(false); setFormDesc(""); setFormAmount(""); setFormError("") }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-stone-100 pb-3 flex-wrap">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
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
              {f === "pending_approval" && pending.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-xs leading-none">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-sm text-stone-400">Cargando…</p>
        ) : filtered.length === 0 ? (
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
                  {canApprove && <th className="pb-2 font-medium text-stone-500">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="py-2 pr-4 font-medium text-stone-800 max-w-[200px]">
                        {req.description}
                      </td>
                      <td className="py-2 pr-4 text-stone-500">{req.requestedBy}</td>
                      <td className="py-2 pr-4 text-stone-500 whitespace-nowrap tabular-nums">
                        {fmtDate(req.requestedAt)}
                      </td>
                      <td className="py-2 pr-4 text-stone-800 font-medium text-right tabular-nums">
                        {fmt(req.amount)}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[req.status]}`}>
                          {STATUS_LABEL[req.status]}
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
                      {canApprove && (
                        <td className="py-2">
                          {req.status === "pending_approval" && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="proj-btn-primary"
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
                                disabled={acting === req.id}
                                onClick={() => handleApprove(req.id)}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="proj-btn-danger-sm"
                                disabled={acting === req.id}
                                onClick={() => { setRejectingId(req.id); setRejectNote("") }}
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Inline reject note */}
                    {rejectingId === req.id && (
                      <tr className="bg-stone-50">
                        <td colSpan={canApprove ? 6 : 5} className="px-3 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              className="proj-form-input flex-1 min-w-[200px]"
                              placeholder="Nota de rechazo (opcional)…"
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="proj-btn-danger-sm"
                              disabled={acting === req.id}
                              onClick={() => handleReject(req.id)}
                            >
                              {acting === req.id ? "Rechazando…" : "Confirmar rechazo"}
                            </button>
                            <button
                              type="button"
                              className="proj-btn-ghost-sm"
                              onClick={() => { setRejectingId(null); setRejectNote("") }}
                            >
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
    </div>
  )
}
