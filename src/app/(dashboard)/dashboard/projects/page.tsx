"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getAllProjects, createProject, finalizeProject, reopenProject,
  setActiveProjectId, getActiveProjectId, approveJoinRequest,
  rejectJoinRequest, updateMemberRole, removeMember,
  getProjectMembers, getJoinRequests,
} from "@/lib/projects-db"
import { Project, UserRole, JoinRequest, ProjectMember } from "@/types/project"

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Propietario",
  architect: "Arquitecto",
  supervisor: "Encargado de Obra",
}

const STATUS_LABEL: Record<string, string> = {
  planning: "Planificación",
  in_progress: "En curso",
  paused: "Pausado",
  completed: "Finalizado",
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

// ─── Copy-to-clipboard helper ─────────────────────────────────────────────────

function InviteCodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard/projects/invite/${code}`
    : ""

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="proj-invite-box">
      <p className="proj-invite-label">Link de invitación</p>
      <div className="proj-invite-row">
        <code className="proj-invite-code">{code}</code>
        <button type="button" className="proj-invite-copy-btn" onClick={handleCopy}>
          {copied ? "✓ Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  )
}

// ─── Join-request row ─────────────────────────────────────────────────────────

function JoinRequestRow({
  req, projectId, onAction,
}: { req: JoinRequest; projectId: string; onAction: () => void }) {
  const [selectedRole, setSelectedRole] = useState<UserRole>("supervisor")

  const handleApprove = async () => {
    await approveJoinRequest(projectId, req.id, selectedRole)
    onAction()
  }
  const handleReject = async () => {
    await rejectJoinRequest(projectId, req.id)
    onAction()
  }

  if (req.status !== "pending") {
    return (
      <div className="proj-jr-row proj-jr-resolved">
        <span className="proj-jr-name">{req.name}</span>
        <span className="proj-jr-email">{req.email}</span>
        <span className={req.status === "approved" ? "proj-jr-badge-ok" : "proj-jr-badge-no"}>
          {req.status === "approved" ? `✓ Aprobado — ${ROLE_LABEL[req.assignedRole!]}` : "✗ Rechazado"}
        </span>
      </div>
    )
  }

  return (
    <div className="proj-jr-row">
      <div className="proj-jr-info">
        <span className="proj-jr-name">{req.name}</span>
        <span className="proj-jr-email">{req.email}</span>
      </div>
      <select
        className="proj-role-select"
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
      >
        <option value="owner">Propietario</option>
        <option value="architect">Arquitecto</option>
        <option value="supervisor">Encargado de Obra</option>
      </select>
      <div className="proj-jr-actions">
        <button type="button" className="proj-btn-approve" onClick={handleApprove}>Aceptar</button>
        <button type="button" className="proj-btn-reject" onClick={handleReject}>Rechazar</button>
      </div>
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member, projectId, canEdit, onAction,
}: { member: ProjectMember; projectId: string; canEdit: boolean; onAction: () => void }) {
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState<UserRole>(member.role)

  const handleSave = async () => {
    await updateMemberRole(projectId, member.userId, role)
    setEditing(false)
    onAction()
  }

  const handleRemove = async () => {
    if (confirm(`¿Eliminar a ${member.name} del proyecto?`)) {
      await removeMember(projectId, member.userId)
      onAction()
    }
  }

  return (
    <div className="proj-member-row">
      <div className="proj-member-avatar">{member.name.charAt(0)}</div>
      <div className="proj-member-info">
        <p className="proj-member-name">{member.name}</p>
        <p className="proj-member-email">{member.email}</p>
      </div>
      {editing ? (
        <div className="proj-member-edit">
          <select className="proj-role-select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="owner">Propietario</option>
            <option value="architect">Arquitecto</option>
            <option value="supervisor">Encargado de Obra</option>
          </select>
          <button type="button" className="proj-btn-approve" onClick={handleSave}>Guardar</button>
          <button type="button" className="proj-btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      ) : (
        <div className="proj-member-actions">
          <span className="proj-role-badge">{ROLE_LABEL[member.role]}</span>
          {canEdit && (
            <>
              <button type="button" className="proj-btn-ghost" onClick={() => setEditing(true)}>Editar rol</button>
              <button type="button" className="proj-btn-danger-sm" onClick={handleRemove}>Quitar</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

type ProjectData = { project: Project; members: ProjectMember[]; joinRequests: JoinRequest[] }

function ProjectCard({
  data, isActive, currentUserRole, onSwitch, onAction,
}: {
  data: ProjectData
  isActive: boolean
  currentUserRole: UserRole
  onSwitch: () => void
  onAction: () => void
}) {
  const { project, members, joinRequests } = data
  const isOwner = currentUserRole === "owner"
  const [expanded, setExpanded] = useState(isActive)

  const pendingRequests = joinRequests.filter((r) => r.status === "pending")

  return (
    <div className={`proj-card ${isActive ? "proj-card-active" : ""} ${project.status === "completed" ? "proj-card-done" : ""}`}>
      {/* Header */}
      <div className="proj-card-header">
        <div className="proj-card-title-row">
          <div>
            <h3 className="proj-card-name">{project.name}</h3>
            <p className="proj-card-meta">{project.address} · Cliente: {project.client}</p>
          </div>
          <div className="proj-card-badges">
            {isActive && <span className="proj-badge-active">Activo</span>}
            <span className={`proj-status-badge proj-status-${project.status}`}>
              {STATUS_LABEL[project.status]}
            </span>
            {pendingRequests.length > 0 && (
              <span className="proj-badge-pending">{pendingRequests.length} solicitud{pendingRequests.length > 1 ? "es" : ""}</span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="proj-stats-row">
          <span>Inicio: {fmtDate(project.startDate)}</span>
          {project.endDate && <span>Fin: {fmtDate(project.endDate)}</span>}
          <span>Presupuesto: {fmt(project.budgetEstimated)}</span>
        </div>

        {/* Actions */}
        <div className="proj-card-actions">
          {!isActive && project.status !== "completed" && (
            <button type="button" className="proj-btn-primary" onClick={onSwitch}>
              Ir a este proyecto
            </button>
          )}
          <button type="button" className="proj-btn-ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Ocultar detalles" : "Ver detalles"}
          </button>
          {isOwner && project.status !== "completed" && (
            <button
              type="button"
              className="proj-btn-danger"
              onClick={async () => {
                if (confirm(`¿Dar por finalizado "${project.name}"? Se marcará como completado.`)) {
                  await finalizeProject(project.id)
                  onAction()
                }
              }}
            >
              Finalizar proyecto
            </button>
          )}
          {isOwner && project.status === "completed" && (
            <button
              type="button"
              className="proj-btn-ghost"
              onClick={async () => { await reopenProject(project.id); onAction() }}
            >
              Reabrir proyecto
            </button>
          )}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="proj-card-body">
          {/* Invite code — solo owner */}
          {isOwner && project.inviteCode && (
            <InviteCodeBox code={project.inviteCode} />
          )}

          {/* Solicitudes de ingreso — solo owner */}
          {isOwner && joinRequests.length > 0 && (
            <div className="proj-section">
              <p className="proj-section-title">Solicitudes de ingreso</p>
              {joinRequests.map((r) => (
                <JoinRequestRow key={r.id} req={r} projectId={project.id} onAction={onAction} />
              ))}
            </div>
          )}

          {/* Miembros */}
          {members.length > 0 && (
            <div className="proj-section">
              <p className="proj-section-title">Colaboradores ({members.length})</p>
              {members.map((m) => (
                <MemberRow key={m.userId} member={m} projectId={project.id} canEdit={isOwner} onAction={onAction} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New project form ─────────────────────────────────────────────────────────

function NewProjectForm({ userId, userName, userEmail, onCreated }: {
  userId: string; userName: string; userEmail: string; onCreated: () => void
}) {
  const [name, setName]       = useState("")
  const [address, setAddress] = useState("")
  const [client, setClient]   = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [budget, setBudget]   = useState("")
  const [error, setError]     = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !address.trim() || !client.trim()) {
      setError("Completá nombre, dirección y cliente.")
      return
    }
    try {
      const budgetN = parseFloat(budget.replace(/\./g, "").replace(",", ".")) || 0
      const project = await createProject(name.trim(), address.trim(), client.trim(), startDate, budgetN, userName, userEmail, userId)
      setActiveProjectId(project.id)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el proyecto")
    }
  }

  return (
    <form className="proj-new-form" onSubmit={handleSubmit}>
      <h3 className="proj-new-title">Nuevo proyecto</h3>
      {error && <p className="proj-form-error">{error}</p>}
      <div className="proj-form-grid">
        <div className="proj-form-field">
          <label className="proj-form-label">Nombre de la obra *</label>
          <input className="proj-form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Casa Familia López" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Dirección *</label>
          <input className="proj-form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Siempreviva 742, Córdoba" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Cliente *</label>
          <input className="proj-form-input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nombre del comitente" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Fecha de inicio</label>
          <input className="proj-form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Presupuesto estimado ($)</label>
          <input className="proj-form-input" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Ej: 15000000" />
        </div>
      </div>
      <button type="submit" className="proj-btn-primary">Crear proyecto</button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [projectsData, setProjectsData] = useState<ProjectData[]>([])
  const [activeId, setActiveId] = useState("")
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("supervisor")
  const [currentUserId, setCurrentUserId]     = useState("")
  const [currentUserName, setCurrentUserName] = useState("")
  const [currentUserEmail, setCurrentUserEmail] = useState("")
  const [showNewForm, setShowNewForm] = useState(false)

  const reload = useCallback(async () => {
    const projects = await getAllProjects()
    const dataList = await Promise.all(
      projects.map(async (project) => {
        const [members, joinRequests] = await Promise.all([
          getProjectMembers(project.id),
          getJoinRequests(project.id),
        ])
        return { project, members, joinRequests }
      })
    )
    setProjectsData(dataList)
    setActiveId(getActiveProjectId())
  }, [])

  useEffect(() => {
    setMounted(true)
    setActiveId(getActiveProjectId())

    const loadSession = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        setCurrentUserEmail(user.email ?? "")
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, role")
          .eq("id", user.id)
          .single()
        if (profile) {
          setCurrentUserName((profile.name as string) ?? "")
          setCurrentUserRole((profile.role as UserRole) ?? "supervisor")
        }
      }
    }

    loadSession()
    reload()
  }, [reload])

  const handleSwitch = (id: string) => {
    setActiveProjectId(id)
    setActiveId(id)
    router.push("/dashboard")
  }

  if (!mounted) return null

  const isOwner = currentUserRole === "owner"
  const activeProject = projectsData.find((d) => d.project.id === activeId)?.project

  return (
    <div className="page-wrap space-y-6">
      <div>
        <p className="page-eyebrow">Gestión de proyectos</p>
        <h1 className="page-title">Mis Proyectos</h1>
        <p className="page-subtitle">
          {projectsData.length} proyecto{projectsData.length !== 1 ? "s" : ""} · activo:{" "}
          {activeProject?.name ?? "—"}
        </p>
      </div>

      {/* Botón nuevo proyecto — solo owners */}
      {isOwner && (
        <div>
          <button
            type="button"
            className="proj-btn-primary"
            onClick={() => setShowNewForm((v) => !v)}
          >
            {showNewForm ? "Cancelar" : "+ Nuevo proyecto"}
          </button>
          {showNewForm && (
            <div className="mt-4">
              <NewProjectForm
                userId={currentUserId}
                userName={currentUserName}
                userEmail={currentUserEmail}
                onCreated={() => { setShowNewForm(false); reload() }}
              />
            </div>
          )}
        </div>
      )}

      {/* Lista de proyectos */}
      <div className="proj-list">
        {projectsData.map((data) => (
          <ProjectCard
            key={data.project.id}
            data={data}
            isActive={data.project.id === activeId}
            currentUserRole={currentUserRole}
            onSwitch={() => handleSwitch(data.project.id)}
            onAction={reload}
          />
        ))}
      </div>
    </div>
  )
}
