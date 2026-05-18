"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "./app-sidebar"
import { createClient } from "@/lib/supabase/client"
import { getActiveProjectId } from "@/lib/projects-db"
import {
  getPendingPurchaseRequests,
  approvePurchaseRequest,
  rejectPurchaseRequest,
} from "@/lib/mock-db"
import type { PurchaseRequest } from "@/types/project"
import type { UserRole } from "@/types/user"

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
    >
      <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5A4.5 4.5 0 0 0 3.5 6v3.5L2 11h12l-1.5-1.5V6A4.5 4.5 0 0 0 8 1.5Z"
        fill="currentColor"
        opacity=".7"
      />
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function NotificationBell() {
  const pathname                = usePathname()
  const [role, setRole]         = useState<UserRole | null>(null)
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [userName, setUserName] = useState("")
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
    if (profile) setUserName((profile.name as string) ?? "")
    const pid = getActiveProjectId()
    if (!pid) return
    const { data: member } = await supabase
      .from("project_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("project_id", pid)
      .single()
    const r = ((member?.role as UserRole) ?? "supervisor")
    setRole(r)
    if (r === "owner" || r === "architect") {
      const pending = await getPendingPurchaseRequests()
      setRequests(pending)
    }
  }, [])

  useEffect(() => { load() }, [load, pathname])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  if (role !== "owner" && role !== "architect") return null

  const handleApprove = async (id: string) => {
    setLoading(true)
    await approvePurchaseRequest(id, userName)
    await load()
    window.dispatchEvent(new CustomEvent("purchase-request-resolved"))
    setLoading(false)
  }

  const handleReject = async (id: string) => {
    setLoading(true)
    await rejectPurchaseRequest(id, userName)
    await load()
    window.dispatchEvent(new CustomEvent("purchase-request-resolved"))
    setLoading(false)
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificaciones${requests.length > 0 ? ` (${requests.length} pendientes)` : ""}`}
      >
        <IconBell />
        {requests.length > 0 && (
          <span className="notif-bell-badge">{requests.length}</span>
        )}
      </button>

      {open && (
        <div className="notif-bell-dropdown">
          <div className="notif-bell-header">
            <span>Solicitudes de compra</span>
            {requests.length > 0 && (
              <span style={{ color: "#dc2626", fontSize: "0.7rem" }}>
                {requests.length} pendiente{requests.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="notif-bell-body">
            {requests.length === 0 ? (
              <p className="notif-bell-empty">Sin solicitudes pendientes</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="notif-bell-item">
                  <p className="notif-bell-item-desc">{r.description}</p>
                  <p className="notif-bell-item-meta">
                    Solicitado por <strong>{r.requestedBy}</strong> · {fmtDate(r.requestedAt)}
                  </p>
                  <p className="notif-bell-item-amount">{fmt(r.amount)}</p>
                  <div className="notif-bell-item-actions">
                    <button
                      type="button"
                      className="notif-approve-btn"
                      onClick={() => handleApprove(r.id)}
                      disabled={loading}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="notif-reject-btn"
                      onClick={() => handleReject(r.id)}
                      disabled={loading}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true)
  }, [])

  const handleClose  = useCallback(() => setSidebarOpen(false), [])
  const handleToggle = useCallback(() => setSidebarOpen((v) => !v), [])

  return (
    <div className="dashboard-shell">
      <AppSidebar open={sidebarOpen} onClose={handleClose} onToggle={handleToggle} />

      <button
        type="button"
        className={`sidebar-tab ${sidebarOpen ? "sidebar-tab--open" : "sidebar-tab--closed"}`}
        onClick={handleToggle}
        aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
      >
        <IconChevron open={sidebarOpen} />
      </button>

      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <NotificationBell />
        </header>
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  )
}
