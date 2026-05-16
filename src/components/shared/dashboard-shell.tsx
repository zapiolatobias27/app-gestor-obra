"use client"

import React, { useCallback, useEffect, useState } from "react"
import { AppSidebar } from "./app-sidebar"

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

      <main className="dashboard-main">
        {children}
      </main>
    </div>
  )
}
