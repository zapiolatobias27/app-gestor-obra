"use client"

import React, { useCallback, useMemo, useState } from "react"
import { getStages, getTasks } from "@/lib/mock-db"
import { StagesList } from "@/features/stages/components/stages-list"
import { EtapasEditor } from "@/features/import/components/etapas-editor"

export default function StagesPage() {
  const [mounted, setMounted]       = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm]     = useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  const stages = useMemo(() => mounted ? getStages() : [], [refreshKey, mounted])
  const tasks  = useMemo(() => mounted ? getTasks()  : [], [refreshKey, mounted])

  const total     = tasks.length
  const completed = tasks.filter((t) => t.status === "completed").length
  const blocked   = tasks.filter((t) => t.status === "blocked").length

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setShowForm(false)
  }, [])

  if (!mounted) return null

  return (
    <div className="page-wrap space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Planilla de obra</p>
          <h1 className="page-title">Etapas del Proyecto</h1>
          <p className="page-subtitle">
            {completed} de {total} tareas completadas
            {blocked > 0 && ` · ${blocked} bloqueada${blocked > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          type="button"
          className={showForm ? "proj-btn-ghost mt-1" : "proj-btn-primary mt-1"}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancelar" : "+ Agregar etapa"}
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-4">Nueva etapa</h2>
          <EtapasEditor onSaved={handleSaved} />
        </div>
      )}

      <StagesList stages={stages} tasks={tasks} />
    </div>
  )
}
