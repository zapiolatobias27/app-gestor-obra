"use client"

import { createClient } from "@/lib/supabase/client"
import type { Project, ProjectMember, JoinRequest } from "@/types/project"
import type { UserRole } from "@/types/user"

// El ID del proyecto activo sigue en localStorage (es solo una preferencia de UI)
const ACTIVE_KEY = "obra:active-project"

export function getActiveProjectId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(ACTIVE_KEY) ?? ""
}

export function setActiveProjectId(id: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_KEY, id)
}

// ─── Mappers snake_case → camelCase ──────────────────────────────────────────

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    address: row.address as string,
    client: row.client as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string | undefined,
    status: row.status as Project["status"],
    budgetEstimated: row.budget_estimated as number,
    budgetReal: row.budget_real as number,
    inviteCode: row.invite_code as string | undefined,
  }
}

function mapMember(row: Record<string, unknown>): ProjectMember {
  return {
    userId: row.user_id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as UserRole,
    joinedAt: row.joined_at as string,
  }
}

function mapJoinRequest(row: Record<string, unknown>): JoinRequest {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    requestedAt: row.requested_at as string,
    status: row.status as JoinRequest["status"],
    assignedRole: row.assigned_role as UserRole | undefined,
    reviewedAt: row.reviewed_at as string | undefined,
    userId: (row.user_id as string | null) ?? undefined,
  }
}

// ─── Project queries ──────────────────────────────────────────────────────────

export async function getAllProjects(): Promise<Project[]> {
  const supabase = createClient()
  const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false })
  return (data ?? []).map(mapProject)
}

export async function getActiveProject(): Promise<Project | null> {
  const supabase = createClient()
  let id = getActiveProjectId()

  if (!id) {
    const { data } = await supabase
      .from("project_members")
      .select("project_id")
      .limit(1)
      .single()
    if (!data) return null
    id = data.project_id as string
    setActiveProjectId(id)
  }

  const { data } = await supabase.from("projects").select("*").eq("id", id).single()
  return data ? mapProject(data) : null
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = createClient()
  const { data } = await supabase.from("project_members").select("*").eq("project_id", projectId)
  return (data ?? []).map(mapMember)
}

export async function getJoinRequests(projectId: string): Promise<JoinRequest[]> {
  const supabase = createClient()
  const { data } = await supabase.from("join_requests").select("*").eq("project_id", projectId).order("requested_at", { ascending: false })
  return (data ?? []).map(mapJoinRequest)
}

export async function createProject(
  name: string,
  address: string,
  client: string,
  startDate: string,
  budgetEstimated: number,
  creatorName: string,
  creatorEmail: string,
  _creatorUserId: string,
): Promise<Project> {
  const supabase = createClient()
  const inviteCode = "INV-" + Math.random().toString(36).slice(2, 8).toUpperCase()

  const { data, error } = await supabase.rpc("create_project_for_user", {
    p_name:             name,
    p_address:          address,
    p_client:           client,
    p_start_date:       startDate,
    p_budget_estimated: budgetEstimated,
    p_creator_name:     creatorName,
    p_creator_email:    creatorEmail,
    p_invite_code:      inviteCode,
  })

  if (error) throw new Error(error.message)
  return mapProject(data as Record<string, unknown>)
}

export async function finalizeProject(projectId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from("projects")
    .update({ status: "completed", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", projectId)
}

export async function reopenProject(projectId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("projects").update({ status: "in_progress" }).eq("id", projectId)
}

// ─── Invite / join ────────────────────────────────────────────────────────────

export async function getProjectByInviteCode(code: string): Promise<Project | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_project_by_invite_code", { p_code: code })
  if (error) {
    // RPC doesn't exist yet — throw so the UI shows a clear setup message
    throw new Error("SETUP_REQUIRED")
  }
  const row = Array.isArray(data) ? (data[0] ?? null) : null
  return row ? mapProject(row as Record<string, unknown>) : null
}

export async function joinProjectByCode(code: string): Promise<Project> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("join_project_by_code", { p_code: code })
  if (error) {
    if (error.message.includes("INVALID_CODE"))      throw new Error("INVALID_CODE")
    if (error.message.includes("ALREADY_MEMBER"))    throw new Error("ALREADY_MEMBER")
    if (error.message.includes("NOT_AUTHENTICATED")) throw new Error("NOT_AUTHENTICATED")
    throw new Error("SETUP_REQUIRED")
  }
  return mapProject(data as Record<string, unknown>)
}

export async function approveJoinRequest(projectId: string, requestId: string, role: UserRole): Promise<void> {
  const supabase = createClient()
  const { data: req, error: fetchError } = await supabase
    .from("join_requests").select("*").eq("id", requestId).single()
  if (fetchError || !req) throw new Error("No se encontró la solicitud")

  const { error: updateError } = await supabase.from("join_requests").update({
    status: "approved",
    assigned_role: role,
    reviewed_at: new Date().toISOString(),
  }).eq("id", requestId)
  if (updateError) throw new Error(updateError.message)

  // Use the invitee's user_id stored when they submitted the request
  const inviteeId = (req.user_id as string | null) ?? `anon-${Date.now()}`
  const { error: insertError } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: inviteeId,
    name: req.name as string,
    email: req.email as string,
    role,
  })
  if (insertError) throw new Error(insertError.message)
}

export async function rejectJoinRequest(projectId: string, requestId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("join_requests").update({
    status: "rejected",
    reviewed_at: new Date().toISOString(),
  }).eq("id", requestId)
}

export async function updateMemberRole(projectId: string, userId: string, role: UserRole): Promise<void> {
  const supabase = createClient()
  await supabase.from("project_members").update({ role }).eq("project_id", projectId).eq("user_id", userId)
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId)
}

export async function deleteProject(projectId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("delete_project_for_owner", { p_project_id: projectId })
  if (error) throw new Error(error.message)
}

// Tipo exportado para compatibilidad con código existente
export type { Project as ProjectBlob }
