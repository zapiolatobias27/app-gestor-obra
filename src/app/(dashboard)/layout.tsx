"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardShell } from "@/components/shared/dashboard-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    // Guard de sesión — en producción validar con el servidor
    const sessionStr = localStorage.getItem("obra:session")
    if (!sessionStr) {
      router.push("/login")
    }
  }, [router])

  return <DashboardShell>{children}</DashboardShell>
}
