"use client"

import React, { useCallback, useEffect, useState } from "react"
import { getStages, getTasks, deleteStage } from "@/lib/mock-db"
import { Stage, Task } from "@/types/project"
import { StagesList } from "@/features/stages/components/stages-list"
import { EtapasEditor } from "@/features/import/components/etapas-editor"

export default function StagesPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm]     = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
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

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setShowForm(false)
    setEditingStage(null)
  }, [])

  const handleEdit = (stage: Stage) => {
    setShowForm(false)
    setEditingStage(stage)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (stage: Stage) => {
    if (!confirm(`¿Eliminar la etapa "${stage.name}"? También se borrarán sus tareas, insumos y compras.`)) return
    await deleteStage(stage.id)
    setRefreshKey((k) => k + 1)
  }

  const handleNewClick = () => {
    setEditingStage(null)
    setShowForm((v) => !v)
  }

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
          onClick={handleNewClick}
        >
          {showForm ? "Cancelar" : "+ Agregar etapa"}
        </button>
      </div>

      {/* Formulario nueva etapa */}
      {showForm && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-4">Nueva etapa</h2>
          <EtapasEditor onSaved={refresh} />
        </div>
      )}

      {/* Formulario editar etapa */}
      {editingStage && (
        <div className="card-obra p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Editar etapa</h2>
            <button type="button" className="proj-btn-ghost-sm" onClick={() => setEditingStage(null)}>
              Cancelar
            </button>
          </div>
          <EtapasEditor key={editingStage.id} initialSelectedId={editingStage.id} onSaved={refresh} />
        </div>
      )}

      <StagesList stages={stages} tasks={tasks} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  )
}
