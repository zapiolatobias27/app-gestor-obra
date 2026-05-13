"use client"

import React, { useMemo, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getStageById, getTasksByStage } from "@/lib/mock-db"
import { StageDetail } from "@/features/stages/components/stage-detail"
import { UserRole } from "@/types/user"

export default function StageDetailPage() {
  const params  = useParams()
  const stageId = params?.id as string

  const stage = useMemo(() => getStageById(stageId), [stageId])
  const tasks = useMemo(() => getTasksByStage(stageId), [stageId])

  const [role, setRole]     = useState<UserRole>("supervisor")
  const [userId, setUserId] = useState<string>("")

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("obra:session") : null
    if (raw) {
      try {
        const s = JSON.parse(raw)
        setRole(s.user.role)
        setUserId(s.user.id)
      } catch { /* keep defaults */ }
    }
  }, [])

  if (!stage) {
    return (
      <div className="page-wrap">
        <div className="card-obra p-8 text-center">
          <p className="section-title">Etapa no encontrada</p>
          <Link href="/dashboard/stages" className="link-pill mt-4">← Volver a etapas</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="px-6 pt-5 pb-0">
        <Link href="/dashboard/stages" className="link-pill">← Etapas</Link>
      </div>
      <StageDetail
        stage={stage}
        tasks={tasks}
        currentUserId={userId}
        currentUserRole={role}
      />
    </>
  )
}
