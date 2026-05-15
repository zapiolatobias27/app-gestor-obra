"use client"

import React, { useCallback, useEffect, useState } from "react"
import { AppSidebar, IconMenu } from "./app-sidebar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true)
  }, [])

  const handleClose  = useCallback(() => setSidebarOpen(false), [])
  const handleToggle = useCallback(() => setSidebarOpen((v) => !v), [])

  return (
    <div className="dashboard-shell">
      {!sidebarOpen && (
        <button
          type="button"
          className="fab-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
        >
          <IconMenu />
        </button>
      )}

      <AppSidebar
        open={sidebarOpen}
        onClose={handleClose}
        onToggle={handleToggle}
      />

      <main className="dashboard-main">{children}</main>
    </div>
  )
}
