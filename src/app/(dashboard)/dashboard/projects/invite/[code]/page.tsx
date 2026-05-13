"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getProjectByInviteCode, submitJoinRequest } from "@/lib/projects-db"

export default function InvitePage() {
  const params = useParams()
  const code = typeof params.code === "string" ? params.code : ""

  const [mounted, setMounted]   = useState(false)
  const [projectName, setProjectName] = useState("")
  const [notFound, setNotFound] = useState(false)
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState("")

  useEffect(() => {
    setMounted(true)
    const blob = getProjectByInviteCode(code)
    if (!blob) { setNotFound(true); return }
    setProjectName(blob.project.name)
    // Pre-fill from session if logged in
    const raw = localStorage.getItem("obra:session")
    if (raw) {
      try {
        const s = JSON.parse(raw)
        setName(s.user.name ?? "")
        setEmail(s.user.email ?? "")
      } catch { /* ignore */ }
    }
  }, [code])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setError("Completá tu nombre y email."); return }
    const blob = getProjectByInviteCode(code)
    if (!blob) { setError("Proyecto no encontrado."); return }

    // Check if already a member
    const already = (blob.project.members ?? []).some((m) => m.email === email.trim())
    if (already) { setError("Ya sos colaborador de este proyecto."); return }

    // Check for existing pending request
    const exists = (blob.project.joinRequests ?? []).some(
      (r) => r.email === email.trim() && r.status === "pending"
    )
    if (exists) { setError("Ya tenés una solicitud pendiente para este proyecto."); return }

    submitJoinRequest(blob.project.id, name.trim(), email.trim())
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
            El propietario de <strong>{projectName}</strong> revisará tu solicitud y te asignará un rol.
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
            Fuiste invitado a colaborar en <strong>{projectName}</strong>.
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
