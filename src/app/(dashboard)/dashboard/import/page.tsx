"use client"

import React, { useState } from "react"
import { AdminPanel } from "@/features/import/components/admin-panel"
import { ExcelImporter } from "@/features/import/components/excel-importer"

export default function ImportPage() {
  const [importKey, setImportKey] = useState(0)

  return (
    <div className="page-wrap space-y-6">
      <div>
        <p className="page-eyebrow">Herramientas</p>
        <h1 className="page-title">Importar datos</h1>
        <p className="page-subtitle">Cargá tu planilla de Excel o editá los datos manualmente.</p>
      </div>

      {/* Importador de Excel */}
      <div className="card-obra p-5">
        <h2 className="section-title mb-1">Importar desde Excel</h2>
        <p className="page-subtitle mb-4">
          Subí tu planilla de control de obra. Se importan automáticamente las etapas, tareas e insumos de cada hoja ET1, ET2, etc.
        </p>
        <ExcelImporter key={importKey} onImported={() => setImportKey((k) => k + 1)} />
      </div>

      {/* Editor manual */}
      <div className="card-obra p-5">
        <h2 className="section-title mb-4">Carga manual</h2>
        <AdminPanel />
      </div>
    </div>
  )
}
