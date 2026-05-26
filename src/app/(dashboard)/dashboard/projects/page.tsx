"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getAllProjects, createProject, finalizeProject, reopenProject,
  setActiveProjectId, getActiveProjectId, updateMemberRole, removeMember,
  getProjectMembers, deleteProject, updateMemberPermissions,
  getProjectByInviteCode, joinProjectByCode,
} from "@/lib/projects-db"
import { Project, UserRole, ProjectMember, MemberPermissions } from "@/types/project"
import { PERM_TREE, isGroup, defaultPermissions } from "@/lib/permissions"
import { parseNum } from "@/lib/parseNum"

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
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

// ─── Copy-to-clipboard helper ─────────────────────────────────────────────────

function InviteSection({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="proj-invite-box">
      <p className="proj-invite-label">Invitar colaboradores</p>
      <p className="text-xs text-stone-500 mb-2">
        Compartí este código para que otros puedan unirse desde "Colaborar en un proyecto".
      </p>
      <div className="proj-invite-row">
        <code className="proj-invite-code text-lg tracking-widest font-bold">{code}</code>
        <button type="button" className="proj-invite-copy-btn" onClick={handleCopy}>
          {copied ? "✓ Copiado" : "Copiar código"}
        </button>
      </div>
    </div>
  )
}

// ─── Colaborar form ───────────────────────────────────────────────────────────

function ColaborarForm({ onDone }: { onDone: () => void }) {
  const [code, setCode]           = useState("")
  const [found, setFound]         = useState<Project | null>(null)
  const [searching, setSearching] = useState(false)
  const [joining, setJoining]     = useState(false)
  const [joined, setJoined]       = useState(false)
  const [error, setError]         = useState("")

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setSearching(true)
    setError("")
    setFound(null)
    try {
      const proj = await getProjectByInviteCode(code.trim().toUpperCase())
      if (!proj) { setError("Código inválido. Verificá que esté bien escrito."); return }
      setFound(proj)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      setError(msg === "SETUP_REQUIRED"
        ? "Falta configurar Supabase. Corré el SQL de join_project_by_code."
        : "Error al buscar el proyecto.")
    } finally {
      setSearching(false)
    }
  }

  const handleJoin = async () => {
    if (!found) return
    setJoining(true)
    setError("")
    try {
      await joinProjectByCode(code.trim().toUpperCase())
      setJoined(true)
      onDone()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg === "ALREADY_MEMBER")    setError("Ya sos miembro de este proyecto.")
      else if (msg === "INVALID_CODE") setError("Código inválido.")
      else if (msg === "SETUP_REQUIRED") setError("Falta configurar Supabase. Corré el SQL de join_project_by_code.")
      else setError(msg || "Error al unirse al proyecto.")
    } finally {
      setJoining(false)
    }
  }

  if (joined) {
    return (
      <div className="card-obra p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-stone-700 font-medium">
          Te uniste a <strong>{found?.name}</strong>. Ya podés verlo en tu lista.
        </p>
      </div>
    )
  }

  return (
    <div className="card-obra p-5 space-y-4">
      <h3 className="section-title">Colaborar en un proyecto</h3>

      {!found ? (
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="proj-form-input flex-1"
            placeholder="Código de invitación (ej: INV-AB12CD)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="proj-btn-primary" disabled={searching}>
            {searching ? "Buscando…" : "Buscar"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="bg-stone-50 rounded-lg p-4 border border-stone-100">
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Proyecto encontrado</p>
            <p className="font-semibold text-stone-900">{found.name}</p>
            <p className="text-sm text-stone-500">{found.address} · Cliente: {found.client}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="proj-btn-primary" onClick={handleJoin} disabled={joining}>
              {joining ? "Uniéndome…" : "Unirme al proyecto"}
            </button>
            <button type="button" className="proj-btn-ghost" onClick={() => { setFound(null); setCode("") }}>
              Volver
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

function PermissionsModal({
  member, projectId, onClose, onSaved,
}: { member: ProjectMember; projectId: string; onClose: () => void; onSaved: () => void }) {
  const [perms, setPerms] = useState<MemberPermissions>(
    member.permissions ?? defaultPermissions(member.role),
  )
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const setView = (key: string, val: boolean) =>
    setPerms((prev) => ({ ...prev, [key]: { view: val, edit: val ? (prev[key]?.edit ?? true) : false } }))

  const setEdit = (key: string, val: boolean) =>
    setPerms((prev) => ({ ...prev, [key]: { view: prev[key]?.view ?? true, edit: val } }))

  const toggleGroup = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))

  const handleSave = async () => {
    setSaving(true)
    await updateMemberPermissions(projectId, member.userId, perms)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Permisos de acceso</h2>
          <p className="text-sm text-stone-500 mt-0.5">{member.name} · {ROLE_LABEL[member.role]}</p>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-2 px-3">
          <span className="flex-1 text-xs font-semibold text-stone-400 uppercase tracking-wide">Sección</span>
          <span className="w-10 text-center text-xs font-semibold text-stone-400 uppercase tracking-wide">Ver</span>
          <span className="w-14 text-center text-xs font-semibold text-stone-400 uppercase tracking-wide">Editar</span>
        </div>

        <div className="space-y-0.5">
          {PERM_TREE.map((node) => {
            if (isGroup(node)) {
              const open = !collapsed[node.label]
              return (
                <div key={node.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(node.label)}
                    className="w-full flex items-center gap-2 px-3 pt-3 pb-1.5 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                      className={`shrink-0 text-stone-400 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                    >
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{node.label}</span>
                  </button>
                  {open && node.subsections.map((sub) => (
                    <div key={sub.key} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-50 pl-8">
                      <span className="flex-1 text-sm text-stone-700">{sub.label}</span>
                      <div className="w-10 flex justify-center">
                        <input type="checkbox" checked={perms[sub.key]?.view !== false}
                          onChange={(e) => setView(sub.key, e.target.checked)}
                          className="w-4 h-4 accent-stone-700 rounded cursor-pointer" />
                      </div>
                      <div className="w-14 flex justify-center">
                        {sub.hasEdit && (
                          <input type="checkbox"
                            checked={perms[sub.key]?.view !== false && perms[sub.key]?.edit !== false}
                            disabled={perms[sub.key]?.view === false}
                            onChange={(e) => setEdit(sub.key, e.target.checked)}
                            className="w-4 h-4 accent-stone-700 rounded cursor-pointer disabled:opacity-30" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div key={node.key} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-50">
                <span className="flex-1 text-sm text-stone-700">{node.label}</span>
                <div className="w-10 flex justify-center">
                  <input type="checkbox" checked={perms[node.key]?.view !== false}
                    onChange={(e) => setView(node.key, e.target.checked)}
                    className="w-4 h-4 accent-stone-700 rounded cursor-pointer" />
                </div>
                <div className="w-14 flex justify-center">
                  {node.hasEdit && (
                    <input type="checkbox"
                      checked={perms[node.key]?.view !== false && perms[node.key]?.edit !== false}
                      disabled={perms[node.key]?.view === false}
                      onChange={(e) => setEdit(node.key, e.target.checked)}
                      className="w-4 h-4 accent-stone-700 rounded cursor-pointer disabled:opacity-30" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleSave} disabled={saving} className="proj-btn-primary flex-1">
            {saving ? "Guardando…" : "Guardar permisos"}
          </button>
          <button type="button" onClick={onClose} className="proj-btn-ghost flex-1">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function MemberRow({
  member, projectId, canEdit, onAction,
}: { member: ProjectMember; projectId: string; canEdit: boolean; onAction: () => void }) {
  const [editing, setEditing] = useState(false)
  const [showPerms, setShowPerms] = useState(false)
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
    <>
      {showPerms && (
        <PermissionsModal
          member={member}
          projectId={projectId}
          onClose={() => setShowPerms(false)}
          onSaved={onAction}
        />
      )}
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
                <button type="button" className="proj-btn-ghost" onClick={() => setShowPerms(true)}>Permisos</button>
                <button type="button" className="proj-btn-ghost" onClick={() => setEditing(true)}>Editar rol</button>
                <button type="button" className="proj-btn-danger-sm" onClick={handleRemove}>Quitar</button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteProjectModal({
  projectName,
  onConfirm,
  onCancel,
}: {
  projectName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const expected = `Eliminar_${projectName}`
  const matches = input === expected

  const handleConfirm = async () => {
    if (!matches) return
    setLoading(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar")
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Eliminar proyecto</h2>
            <p className="text-sm text-stone-500">Esta acción no se puede deshacer.</p>
          </div>
        </div>

        <p className="text-sm text-stone-700">
          Se eliminarán permanentemente el proyecto, todas sus etapas, tareas, insumos y compras.
        </p>

        <div className="space-y-1.5">
          <p className="text-sm text-stone-600">
            Para confirmar, escribí exactamente:
          </p>
          <code className="block text-sm font-mono bg-stone-100 rounded-lg px-3 py-2 text-red-700 select-all">
            {expected}
          </code>
          <input
            className="proj-form-input mt-2"
            placeholder={expected}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            autoComplete="off"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!matches || loading}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              matches
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            {loading ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

type ProjectData = { project: Project; members: ProjectMember[] }

function ProjectCard({
  data, isActive, currentUserId, onSwitch, onAction,
}: {
  data: ProjectData
  isActive: boolean
  currentUserId: string
  onSwitch: () => void
  onAction: () => void
}) {
  const { project, members } = data
  const isOwner = members.some((m) => m.userId === currentUserId && m.role === "owner")
  const [expanded, setExpanded] = useState(isActive)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

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
          {isOwner && (
            <button type="button" className="proj-btn-danger-sm" onClick={() => setShowDeleteModal(true)}>
              Eliminar proyecto
            </button>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <DeleteProjectModal
          projectName={project.name}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            await deleteProject(project.id)
            setShowDeleteModal(false)
            onAction()
          }}
        />
      )}

      {/* Expanded */}
      {expanded && (
        <div className="proj-card-body">
          {/* Invitar colaboradores — solo owner */}
          {isOwner && project.inviteCode && (
            <InviteSection code={project.inviteCode} />
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
      const budgetN = parseNum(budget)
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
  const [currentUserId, setCurrentUserId]       = useState("")
  const [currentUserName, setCurrentUserName]   = useState("")
  const [currentUserEmail, setCurrentUserEmail] = useState("")
  const [showNewForm, setShowNewForm]           = useState(false)
  const [showColaborar, setShowColaborar]       = useState(false)

  const reload = useCallback(async () => {
    const projects = await getAllProjects()
    const dataList = await Promise.all(
      projects.map(async (project) => {
        const members = await getProjectMembers(project.id)
        return { project, members }
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
          .select("name")
          .eq("id", user.id)
          .single()
        if (profile) {
          setCurrentUserName((profile.name as string) ?? "")
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

      {/* Acciones principales */}
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          className="proj-btn-primary"
          onClick={() => { setShowNewForm((v) => !v); setShowColaborar(false) }}
        >
          {showNewForm ? "Cancelar" : "+ Nuevo proyecto"}
        </button>
        <button
          type="button"
          className="proj-btn-ghost"
          onClick={() => { setShowColaborar((v) => !v); setShowNewForm(false) }}
        >
          {showColaborar ? "Cancelar" : "Colaborar en un proyecto"}
        </button>
      </div>

      {showNewForm && (
        <NewProjectForm
          userId={currentUserId}
          userName={currentUserName}
          userEmail={currentUserEmail}
          onCreated={() => { setShowNewForm(false); reload() }}
        />
      )}

      {showColaborar && (
        <ColaborarForm onDone={reload} />
      )}

      {/* Lista de proyectos */}
      <div className="proj-list">
        {projectsData.map((data) => (
          <ProjectCard
            key={data.project.id}
            data={data}
            isActive={data.project.id === activeId}
            currentUserId={currentUserId}
            onSwitch={() => handleSwitch(data.project.id)}
            onAction={reload}
          />
        ))}
      </div>
    </div>
  )
}
