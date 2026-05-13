"use client"

import React, { useState } from "react"
import { AppSidebar, IconMenu } from "./app-sidebar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="dashboard-shell">
      {/* Botón flotante solo visible en mobile cuando el sidebar está cerrado */}
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
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      <main className="dashboard-main">{children}</main>
    </div>
  )
}
