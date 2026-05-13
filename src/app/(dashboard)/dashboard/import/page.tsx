"use client"

import React from "react"
import { AdminPanel } from "@/features/import/components/admin-panel"

export default function ImportPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">Administración</h1>
        <p className="text-stone-600 mt-2">Gestioná Etapas, Planilla, Stock y Logística desde un solo lugar.</p>
      </div>

      <AdminPanel />
    </div>
  )
}
