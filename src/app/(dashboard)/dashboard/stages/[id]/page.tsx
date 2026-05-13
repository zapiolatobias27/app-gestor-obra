"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getStageById, getTasksByStage } from "@/lib/mock-db"
import { StageDetail } from "@/features/stages/components/stage-detail"
import { Stage, Task } from "@/types/project"
import { UserRole } from "@/types/user"
import { createClient } from "@/lib/supabase/client"

export default function StageDetailPage() {
  const params  = useParams()
  const stageId = params?.id as string

  const [stage, setStage]   = useState<Stage | null>(null)
  const [tasks, setTasks]   = useState<Task[]>([])
  const [role, setRole]     = useState<UserRole>("supervisor")
  const [userId, setUserId] = useState<string>("")

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([getStageById(stageId), getTasksByStage(stageId)])
      setStage(s ?? null)
      setTasks(t)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
        setRole((profile?.role as UserRole) ?? "supervisor")
        setUserId(user.id)
      }
    }
    load()
  }, [stageId])

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
