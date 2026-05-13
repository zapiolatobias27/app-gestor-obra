"use client"

import React, { useCallback, useEffect, useState } from "react"
import { getStages, getTasks } from "@/lib/mock-db"
import { Stage, Task } from "@/types/project"
import { StagesList } from "@/features/stages/components/stages-list"
import { EtapasEditor } from "@/features/import/components/etapas-editor"

export default function StagesPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm]     = useState(false)
  const [stages, setStages]         = useState<Stage[]>([])
  const [tasks, setTasks]           = useState<Task[]>([])

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([getStages(), getTasks()])
      setStages(s)
      setTasks(t)
    }
    load()
  }, [refreshKey])

  const total     = tasks.length
  const completed = tasks.filter((t) => t.status === "completed").length
  const blocked   = tasks.filter((t) => t.status === "blocked").length

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setShowForm(false)
  }, [])

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
