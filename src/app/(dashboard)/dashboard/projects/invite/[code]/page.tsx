"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getProjectByInviteCode, joinProjectByCode } from "@/lib/projects-db"
import { Project } from "@/types/project"

export default function InvitePage() {
  const params = useParams()
  const code = typeof params.code === "string" ? params.code : ""

  const [mounted, setMounted]   = useState(false)
  const [project, setProject]   = useState<Project | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [joining, setJoining]   = useState(false)
  const [joined, setJoined]     = useState(false)
  const [error, setError]       = useState("")

  useEffect(() => {
    setMounted(true)
    getProjectByInviteCode(code)
      .then((proj) => { if (proj) setProject(proj); else setNotFound(true) })
      .catch(() => setNotFound(true))
  }, [code])

  const handleJoin = async () => {
    if (!project) return
    setJoining(true)
    setError("")
    try {
      await joinProjectByCode(code)
      setJoined(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg === "ALREADY_MEMBER")    setError("Ya sos miembro de este proyecto.")
      else if (msg === "SETUP_REQUIRED") setError("Falta configurar Supabase.")
      else setError(msg || "Error al unirse al proyecto.")
    } finally {
      setJoining(false)
    }
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

  if (joined) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-success-icon">✓</div>
          <h2 className="invite-title">¡Te uniste al proyecto!</h2>
          <p className="invite-subtitle">
            Ya sos colaborador de <strong>{project?.name}</strong>. El propietario puede asignarte un rol distinto.
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
            Fuiste invitado a colaborar en <strong>{project?.name ?? "…"}</strong>.
          </p>
        </div>

        {project && (
          <div className="bg-stone-50 rounded-lg p-4 border border-stone-100 text-sm text-stone-600">
            <p>{project.address}</p>
            <p>Cliente: {project.client}</p>
          </div>
        )}

        {error && <p className="proj-form-error">{error}</p>}

        <button
          type="button"
          className="proj-btn-primary"
          style={{ width: "100%" }}
          onClick={handleJoin}
          disabled={joining || !project}
        >
          {joining ? "Uniéndome…" : "Unirme al proyecto"}
        </button>

        <p className="invite-footer-note">
          Te vas a unir con el rol de Encargado de Obra. El propietario puede cambiarlo después.
        </p>
      </div>
    </div>
  )
}
