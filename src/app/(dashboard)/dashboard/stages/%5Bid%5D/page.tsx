"use client"

import React, { useMemo } from "react"
import { useParams } from "next/navigation"
import { getStageById, getTasksByStage } from "@/lib/mock-db"
import { StageDetail } from "@/features/stages/components/stage-detail"
import Link from "next/link"

export default function StageDetailPage() {
  const { id } = useParams()
  const stageId = typeof id === "string" ? id : id?.[0]

  const stage = useMemo(() => (stageId ? getStageById(stageId) : null), [stageId])
  const tasks = useMemo(() => (stageId ? getTasksByStage(stageId) : []), [stageId])

  if (!stage) {
    return (
      <div className="p-8">
        <p className="text-gray-600">Etapa no encontrada</p>
        <Link href="/dashboard/stages" className="text-blue-600 hover:underline">
          Volver a etapas
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <Link href="/dashboard/stages" className="text-blue-600 hover:underline text-sm">
        ← Volver a etapas
      </Link>
      <StageDetail stage={stage} tasks={tasks} />
    </div>
  )
}
