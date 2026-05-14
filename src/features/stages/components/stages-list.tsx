"use client"

import React from "react"
import Link from "next/link"
import { Stage, Task, TaskStatus } from "@/types/project"

interface StagesListProps {
  stages: Stage[]
  tasks: Task[]
  onEdit?: (stage: Stage) => void
  onDelete?: (stage: Stage) => void
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending:     "Pendiente",
  in_progress: "En Proceso",
  completed:   "Completada",
  blocked:     "Bloqueada",
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending:     "badge-pending",
  in_progress: "badge-progress",
  completed:   "badge-done",
  blocked:     "badge-blocked",
}

export function StagesList({ stages, tasks, onEdit, onDelete }: StagesListProps) {
  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const st      = tasks.filter((t) => t.stageId === stage.id)
        const done    = st.filter((t) => t.status === "completed").length
        const blocked = st.filter((t) => t.status === "blocked").length
        const pct     = st.length > 0 ? Math.round((done / st.length) * 100) : 0

        return (
          <div key={stage.id} className="card-obra p-4">
            <Link href={`/dashboard/stages/${stage.id}`} className="block group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="stage-code">{stage.code}</span>
                  <div>
                    <h3 className="stage-name group-hover:underline">{stage.name}</h3>
                    <p className="task-meta">
                      {st.length} tarea{st.length !== 1 ? "s" : ""}
                      {blocked > 0 && ` · ${blocked} bloqueada${blocked > 1 ? "s" : ""}`}
                      {stage.weekStart && stage.weekEnd && ` · Sem. ${stage.weekStart}–${stage.weekEnd}`}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_BADGE[stage.status]}`}>
                  {STATUS_LABEL[stage.status]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="progress-track flex-1">
                  <div
                    className={`progress-fill ${stage.status === "completed" ? "progress-fill-done" : ""}`}
                    ref={(el) => { if (el) el.style.width = `${pct}%` }}
                  />
                </div>
                <span className="stage-pct">{pct}%</span>
              </div>
            </Link>
            {(onEdit || onDelete) && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                {onEdit && (
                  <button type="button" className="proj-btn-ghost-sm" onClick={() => onEdit(stage)}>
                    Editar
                  </button>
                )}
                {onDelete && (
                  <button type="button" className="proj-btn-danger-sm" onClick={() => onDelete(stage)}>
                    Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
