"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getProjectByInviteCode, getProjectMembers, getJoinRequests, submitJoinRequest } from "@/lib/projects-db"
import { Project } from "@/types/project"

export default function InvitePage() {
  const params = useParams()
  const code = typeof params.code === "string" ? params.code : ""

  const [mounted, setMounted]   = useState(false)
  const [project, setProject]   = useState<Project | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState("")

  useEffect(() => {
    setMounted(true)

    const load = async () => {
      const proj = await getProjectByInviteCode(code)
      if (!proj) { setNotFound(true); return }
      setProject(proj)

      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email ?? "")
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
        if (profile) setName((profile.name as string) ?? "")
      }
    }

    load()
  }, [code])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setError("Completá tu nombre y email."); return }
    if (!project) { setError("Proyecto no encontrado."); return }

    const [members, joinRequests] = await Promise.all([
      getProjectMembers(project.id),
      getJoinRequests(project.id),
    ])

    const already = members.some((m) => m.email === email.trim())
    if (already) { setError("Ya sos colaborador de este proyecto."); return }

    const exists = joinRequests.some((r) => r.email === email.trim() && r.status === "pending")
    if (exists) { setError("Ya tenés una solicitud pendiente para este proyecto."); return }

    await submitJoinRequest(project.id, name.trim(), email.trim())
    setSent(true)
  }

  if (!mounted) return null

  if (notFound) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <p className="invite-not-found">El link de invitación no es válido o ya expiró.</p>
        </div>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-success-icon">✓</div>
          <h2 className="invite-title">¡Solicitud enviada!</h2>
          <p className="invite-subtitle">
            El propietario de <strong>{project?.name}</strong> revisará tu solicitud y te asignará un rol.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-header">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="4" y="20" width="24" height="4" rx="1" fill="var(--sand-300)" />
            <rect x="8" y="10" width="16" height="12" rx="1" fill="var(--sand-200)" />
            <path d="M6 10 L16 4 L26 10" stroke="var(--clay-400)" strokeWidth="2" fill="none" strokeLinejoin="round" />
            <rect x="13" y="14" width="6" height="8" rx="1" fill="var(--clay-500)" />
          </svg>
          <h2 className="invite-title">Invitación al proyecto</h2>
          <p className="invite-subtitle">
            Fuiste invitado a colaborar en <strong>{project?.name ?? "..."}</strong>.
            Completá tus datos para enviar una solicitud de acceso.
          </p>
        </div>

        <form className="invite-form" onSubmit={handleSubmit}>
          {error && <p className="proj-form-error">{error}</p>}
          <div className="proj-form-field">
            <label className="proj-form-label">Tu nombre completo *</label>
            <input
              className="proj-form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Ana García"
            />
          </div>
          <div className="proj-form-field">
            <label className="proj-form-label">Tu email *</label>
            <input
              className="proj-form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@ejemplo.com"
            />
          </div>
          <button type="submit" className="proj-btn-primary" style={{ width: "100%" }}>
            Solicitar acceso
          </button>
        </form>

        <p className="invite-footer-note">
          El propietario del proyecto revisará tu solicitud y te asignará un rol antes de aceptarte.
        </p>
      </div>
    </div>
  )
}
