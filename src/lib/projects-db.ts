"use client"

import {
  Project, Stage, Task, Photo,
  PurchaseScheduleItem, PurchaseRequest, BudgetMovement,
  ProjectMember, JoinRequest, UserRole, CalendarEvent,
} from "@/types/project"
import { SupplyItem, AuditAlert } from "@/types/stock"

// ─── Keys ────────────────────────────────────────────────────────────────────

const PROJECTS_KEY   = "obra:projects:v1"
const ACTIVE_KEY     = "obra:active-project"

// ─── Per-project data blob ────────────────────────────────────────────────────

export interface ProjectBlob {
  project: Project
  stages: Stage[]
  tasks: Task[]
  photos: Photo[]
  supplies: SupplyItem[]
  alerts: AuditAlert[]
  purchases: PurchaseScheduleItem[]
  purchaseRequests: PurchaseRequest[]
  budgetMovements: BudgetMovement[]
  calendarEvents?: CalendarEvent[]
}

// ─── Top-level store ──────────────────────────────────────────────────────────

interface ProjectsStore {
  projects: ProjectBlob[]
}

// ─── Seed data for the default project ───────────────────────────────────────

const SEED_PROJECT: ProjectBlob = {
  project: {
    id: "proj-1",
    name: "Casa Residencial Familia García",
    address: "Av. Los Aromos 1540, Mendoza",
    client: "Roberto García",
    startDate: "2024-02-01",
    endDate: "2024-11-30",
    status: "in_progress",
    budgetEstimated: 18500000,
    budgetReal: 7200000,
    members: [
      { userId: "1", name: "Juan Propietario", email: "propietario@obra.demo", role: "owner", joinedAt: "2024-02-01" },
      { userId: "2", name: "María Arquitecta",  email: "arquitecto@obra.demo",  role: "architect", joinedAt: "2024-02-01" },
      { userId: "3", name: "Carlos Encargado",  email: "encargado@obra.demo",   role: "supervisor", joinedAt: "2024-02-01" },
    ],
    joinRequests: [],
    inviteCode: "INV-GARCIA1",
  },
  stages: [
    { id: "s1", projectId: "proj-1", code: "ET1", name: "Lote y Replanteo",              order: 1, status: "completed",   startDate: "2024-02-01", endDate: "2024-02-14", weekStart: 1,  weekEnd: 2  },
    { id: "s2", projectId: "proj-1", code: "ET2", name: "Excavación y Fundaciones",       order: 2, status: "completed",   startDate: "2024-02-15", endDate: "2024-03-15", weekStart: 3,  weekEnd: 6  },
    { id: "s3", projectId: "proj-1", code: "ET3", name: "Estructura y Losa",              order: 3, status: "in_progress", startDate: "2024-03-18", endDate: "2024-05-10", weekStart: 7,  weekEnd: 14 },
    { id: "s4", projectId: "proj-1", code: "ET4", name: "Mampostería y Cerramientos",     order: 4, status: "pending",     startDate: "2024-05-13", endDate: "2024-06-21", weekStart: 15, weekEnd: 20 },
    { id: "s5", projectId: "proj-1", code: "ET5", name: "Cubierta y Aislaciones",         order: 5, status: "pending",     startDate: "2024-06-24", endDate: "2024-07-19", weekStart: 21, weekEnd: 24 },
    { id: "s6", projectId: "proj-1", code: "ET6", name: "Instalaciones (Elec/Gas/Agua)",  order: 6, status: "pending",     startDate: "2024-07-22", endDate: "2024-09-06", weekStart: 25, weekEnd: 32 },
    { id: "s7", projectId: "proj-1", code: "ET7", name: "Revestimientos y Terminaciones", order: 7, status: "pending",     startDate: "2024-09-09", endDate: "2024-10-25", weekStart: 33, weekEnd: 40 },
    { id: "s8", projectId: "proj-1", code: "ET8", name: "Entrega y Limpieza Final",       order: 8, status: "pending",     startDate: "2024-10-28", endDate: "2024-11-22", weekStart: 41, weekEnd: 44 },
  ],
  tasks: [
    { id: "t1-1", stageId: "s1", category: "Topografía",         title: "Mensura y verificación de límites",              status: "completed",   responsibleRole: "architect", weekStart: 1,  weekEnd: 1,  observations: "Sin novedades, lote conforme a planos.", photos: [], completedAt: "2024-02-05" },
    { id: "t1-2", stageId: "s1", category: "Replanteo",          title: "Replanteo general de la planta",                 status: "completed",   responsibleRole: "supervisor", weekStart: 1, weekEnd: 2,  photos: [], completedAt: "2024-02-12" },
    { id: "t1-3", stageId: "s1", category: "Habilitación",       title: "Tramitación de permiso de obra",                 status: "completed",   responsibleRole: "architect", weekStart: 1,  weekEnd: 2,  observations: "Permiso Nro. 2024-1540 otorgado.", photos: [], completedAt: "2024-02-13" },
    { id: "t2-1", stageId: "s2", category: "Movimiento de suelos", title: "Excavación general hasta cota -1.20m",         status: "completed",   responsibleRole: "supervisor", weekStart: 3, weekEnd: 3,  photos: [], completedAt: "2024-02-20" },
    { id: "t2-2", stageId: "s2", category: "Hormigón",           title: "Armado y hormigonado de vigas de fundación",     status: "completed",   responsibleRole: "supervisor", weekStart: 4, weekEnd: 5,  observations: "H-21 utilizado según especificación.", photos: [], completedAt: "2024-03-05" },
    { id: "t2-3", stageId: "s2", category: "Impermeabilización", title: "Impermeabilización de cimientos",                status: "completed",   responsibleRole: "supervisor", weekStart: 6, weekEnd: 6,  photos: [], completedAt: "2024-03-14" },
    { id: "t3-1", stageId: "s3", category: "Estructura metálica", title: "Colocación de columnas HEB 200",                status: "completed",   responsibleRole: "supervisor", weekStart: 7, weekEnd: 9,  photos: [], completedAt: "2024-04-02" },
    { id: "t3-2", stageId: "s3", category: "Estructura metálica", title: "Montaje de vigas IPN principales",              status: "in_progress", responsibleRole: "supervisor", weekStart: 10, weekEnd: 12, observations: "En ejecución. Falta sector cocina.", photos: [] },
    { id: "t3-3", stageId: "s3", category: "Hormigón",           title: "Armado y hormigonado de losa planta baja",       status: "pending",     responsibleRole: "supervisor", weekStart: 12, weekEnd: 14, photos: [] },
    { id: "t3-4", stageId: "s3", category: "Andamios",           title: "Montaje y desmontaje de andamiaje",              status: "in_progress", responsibleRole: "supervisor", weekStart: 7,  weekEnd: 14, photos: [] },
    { id: "t4-1", stageId: "s4", category: "Albañilería",        title: "Levantamiento de muros exteriores",              status: "pending",     responsibleRole: "supervisor", weekStart: 15, weekEnd: 18, photos: [] },
    { id: "t4-2", stageId: "s4", category: "Albañilería",        title: "Levantamiento de tabiques interiores",           status: "pending",     responsibleRole: "supervisor", weekStart: 17, weekEnd: 19, photos: [] },
    { id: "t4-3", stageId: "s4", category: "Aberturas",          title: "Colocación de marcos y premarcos",               status: "pending",     responsibleRole: "architect",  weekStart: 19, weekEnd: 20, photos: [] },
    { id: "t5-1", stageId: "s5", category: "Estructura cubierta", title: "Montaje de estructura metálica de techo",       status: "pending",     responsibleRole: "supervisor", weekStart: 21, weekEnd: 22, photos: [] },
    { id: "t5-2", stageId: "s5", category: "Cubierta",           title: "Colocación de chapa prepintada color arena",     status: "pending",     responsibleRole: "supervisor", weekStart: 22, weekEnd: 23, photos: [] },
    { id: "t5-3", stageId: "s5", category: "Aislación",          title: "Colocación de membrana asfáltica doble capa",    status: "blocked",     responsibleRole: "supervisor", weekStart: 23, weekEnd: 24, observations: "BLOQUEADO: esperando aprobación de proveedor alternativo.", photos: [] },
    { id: "t6-1", stageId: "s6", category: "Electricidad",       title: "Tendido de cañerías eléctricas y cajas",         status: "pending",     responsibleRole: "supervisor", weekStart: 25, weekEnd: 28, photos: [] },
    { id: "t6-2", stageId: "s6", category: "Sanitaria",          title: "Instalación de red cloacal y pluvial",           status: "pending",     responsibleRole: "supervisor", weekStart: 25, weekEnd: 29, photos: [] },
    { id: "t6-3", stageId: "s6", category: "Gas",                title: "Tendido e inspección red de gas natural",        status: "pending",     responsibleRole: "architect",  weekStart: 30, weekEnd: 32, photos: [] },
    { id: "t7-1", stageId: "s7", category: "Revoques",           title: "Revoque grueso interior y exterior",             status: "pending",     responsibleRole: "supervisor", weekStart: 33, weekEnd: 36, photos: [] },
    { id: "t7-2", stageId: "s7", category: "Pisos",              title: "Colocación de porcelanato 60x60 planta baja",    status: "pending",     responsibleRole: "supervisor", weekStart: 36, weekEnd: 38, photos: [] },
    { id: "t7-3", stageId: "s7", category: "Pintura",            title: "Pintura látex interior y exterior",              status: "pending",     responsibleRole: "supervisor", weekStart: 38, weekEnd: 40, photos: [] },
    { id: "t7-4", stageId: "s7", category: "Aberturas",          title: "Colocación de puertas y ventanas aluminio",      status: "pending",     responsibleRole: "architect",  weekStart: 37, weekEnd: 39, photos: [] },
    { id: "t8-1", stageId: "s8", category: "Limpieza",           title: "Limpieza fina de obra y desescombro final",      status: "pending",     responsibleRole: "supervisor", weekStart: 41, weekEnd: 42, photos: [] },
    { id: "t8-2", stageId: "s8", category: "Inspección",         title: "Inspección final municipal",                     status: "pending",     responsibleRole: "architect",  weekStart: 42, weekEnd: 43, photos: [] },
    { id: "t8-3", stageId: "s8", category: "Entrega",            title: "Entrega de llaves y documentación al propietario", status: "pending",   responsibleRole: "owner",      weekStart: 44, weekEnd: 44, photos: [] },
  ],
  photos: [],
  supplies: [
    { id: "sup-1", stageId: "s2", taskId: "t2-2", name: "Cemento Portland CPN 40",        unit: "bolsa 50kg", plannedQty: 200, realQty: 214, estimatedUnitCost: 3200, realUnitCost: 3350, autoDiscountOnComplete: true },
    { id: "sup-2", stageId: "s2", taskId: "t2-2", name: "Arena fina lavada",              unit: "m³",         plannedQty: 30,  realQty: 31,  estimatedUnitCost: 18000 },
    { id: "sup-3", stageId: "s2", taskId: "t2-2", name: "Grava 19mm",                    unit: "m³",         plannedQty: 22,  realQty: 28,  estimatedUnitCost: 22000, autoDiscountOnComplete: true },
    { id: "sup-4", stageId: "s3", taskId: "t3-1", name: "Perfil HEB 200 (acero)",         unit: "m",          plannedQty: 240, realQty: 240, estimatedUnitCost: 8500 },
    { id: "sup-5", stageId: "s3", taskId: "t3-2", name: "Perfil IPN 180",                 unit: "m",          plannedQty: 180, realQty: 0,   estimatedUnitCost: 6800 },
    { id: "sup-6", stageId: "s3", taskId: "t3-3", name: "Hormigón premezclado H-21",      unit: "m³",         plannedQty: 85,  realQty: 0,   estimatedUnitCost: 75000 },
    { id: "sup-7", stageId: "s3", taskId: "t3-3", name: "Malla electrosoldada Ø8 c/15cm", unit: "m²",         plannedQty: 320, realQty: 0,   estimatedUnitCost: 4200 },
    { id: "sup-8", stageId: "s4", taskId: "t4-1", name: "Bloque cerámico 18x19x33",       unit: "unidad",     plannedQty: 4800, realQty: 0,  estimatedUnitCost: 420 },
    { id: "sup-9", stageId: "s4", taskId: "t4-1", name: "Cemento de albañilería",          unit: "bolsa 40kg", plannedQty: 350, realQty: 0,   estimatedUnitCost: 2800 },
    { id: "sup-10", stageId: "s5", taskId: "t5-2", name: "Chapa prepintada N°25",          unit: "m²",         plannedQty: 220, realQty: 0,   estimatedUnitCost: 9500 },
    { id: "sup-11", stageId: "s5", taskId: "t5-3", name: "Membrana asfáltica 4mm",         unit: "m²",         plannedQty: 220, realQty: 0,   estimatedUnitCost: 7800 },
  ],
  alerts: [
    { id: "alert-1", supplyItemId: "sup-3", supplyName: "Grava 19mm",           taskId: "t2-2", stageId: "s2", plannedQty: 22, realQty: 28, deviationPct: 27.3, severity: "high",   createdAt: "2024-03-05", status: "active" },
    { id: "alert-2", supplyItemId: "sup-1", supplyName: "Cemento Portland CPN 40", taskId: "t2-2", stageId: "s2", plannedQty: 200, realQty: 214, deviationPct: 7.0, severity: "medium", createdAt: "2024-03-05", status: "active" },
  ],
  purchases: [
    { id: "pc-1", stageId: "s3", taskId: "t3-2", material: "Perfil IPN 180",          unit: "m",      quantity: 180, deliveryWeek: 10, status: "ordered",  estimatedCost: 1224000, notes: "Proveedor: Aceros del Norte" },
    { id: "pc-2", stageId: "s3", taskId: "t3-3", material: "Hormigón premezclado H-21", unit: "m³",  quantity: 85,  deliveryWeek: 12, status: "pending",  estimatedCost: 6375000, notes: "Coordinar fecha exacta con Hormix S.A." },
    { id: "pc-3", stageId: "s3", taskId: "t3-3", material: "Malla electrosoldada Ø8",  unit: "m²",  quantity: 320, deliveryWeek: 11, status: "pending",  estimatedCost: 1344000 },
    { id: "pc-4", stageId: "s4", taskId: "t4-1", material: "Bloque cerámico 18x19x33", unit: "unidad", quantity: 4800, deliveryWeek: 15, status: "pending", estimatedCost: 2016000 },
    { id: "pc-5", stageId: "s5", taskId: "t5-3", material: "Membrana asfáltica 4mm",  unit: "m²",   quantity: 220, deliveryWeek: 23, status: "critical", estimatedCost: 1716000, notes: "⚠ Stock roto en proveedor habitual." },
    { id: "pc-6", stageId: "s5", taskId: "t5-2", material: "Chapa prepintada N°25",   unit: "m²",   quantity: 220, deliveryWeek: 22, status: "pending",  estimatedCost: 2090000 },
  ],
  purchaseRequests: [],
  budgetMovements: [],
}

// ─── Read / write store ───────────────────────────────────────────────────────

function readStore(): ProjectsStore {
  if (typeof window === "undefined") return { projects: [SEED_PROJECT] }
  const raw = localStorage.getItem(PROJECTS_KEY)
  if (!raw) return { projects: [SEED_PROJECT] }
  try {
    return JSON.parse(raw) as ProjectsStore
  } catch {
    return { projects: [SEED_PROJECT] }
  }
}

function writeStore(store: ProjectsStore): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(store))
}

// ─── Active project ───────────────────────────────────────────────────────────

export function getActiveProjectId(): string {
  if (typeof window === "undefined") return "proj-1"
  return localStorage.getItem(ACTIVE_KEY) ?? "proj-1"
}

export function setActiveProjectId(id: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_KEY, id)
}

// ─── Project CRUD ─────────────────────────────────────────────────────────────

export function getAllProjectBlobs(): ProjectBlob[] {
  return readStore().projects
}

export function getActiveBlob(): ProjectBlob {
  const store = readStore()
  const id = getActiveProjectId()
  return store.projects.find((p) => p.project.id === id) ?? store.projects[0]
}

export function saveActiveBlob(blob: ProjectBlob): void {
  const store = readStore()
  const idx = store.projects.findIndex((p) => p.project.id === blob.project.id)
  if (idx >= 0) store.projects[idx] = blob
  else store.projects.push(blob)
  writeStore(store)
}

export function createProject(
  name: string,
  address: string,
  client: string,
  startDate: string,
  budgetEstimated: number,
  creatorName: string,
  creatorEmail: string,
  creatorUserId: string,
): ProjectBlob {
  const id = `proj-${Date.now()}`
  const code = "INV-" + Math.random().toString(36).slice(2, 8).toUpperCase()
  const blob: ProjectBlob = {
    project: {
      id,
      name,
      address,
      client,
      startDate,
      status: "planning",
      budgetEstimated,
      budgetReal: 0,
      members: [{ userId: creatorUserId, name: creatorName, email: creatorEmail, role: "owner", joinedAt: new Date().toISOString() }],
      joinRequests: [],
      inviteCode: code,
    },
    stages: [],
    tasks: [],
    photos: [],
    supplies: [],
    alerts: [],
    purchases: [],
    purchaseRequests: [],
    budgetMovements: [],
  }
  const store = readStore()
  store.projects.push(blob)
  writeStore(store)
  return blob
}

export function finalizeProject(projectId: string): void {
  const store = readStore()
  const blob = store.projects.find((p) => p.project.id === projectId)
  if (blob) {
    blob.project.status = "completed"
    blob.project.endDate = new Date().toISOString().slice(0, 10)
    writeStore(store)
  }
}

export function reopenProject(projectId: string): void {
  const store = readStore()
  const blob = store.projects.find((p) => p.project.id === projectId)
  if (blob) {
    blob.project.status = "in_progress"
    writeStore(store)
  }
}

// ─── Invite / join ────────────────────────────────────────────────────────────

export function getProjectByInviteCode(code: string): ProjectBlob | undefined {
  return readStore().projects.find((p) => p.project.inviteCode === code)
}

export function submitJoinRequest(projectId: string, name: string, email: string): JoinRequest {
  const store = readStore()
  const blob = store.projects.find((p) => p.project.id === projectId)
  if (!blob) throw new Error("Proyecto no encontrado")
  if (!blob.project.joinRequests) blob.project.joinRequests = []
  const req: JoinRequest = {
    id: `jr-${Date.now()}`,
    name,
    email,
    requestedAt: new Date().toISOString(),
    status: "pending",
  }
  blob.project.joinRequests.push(req)
  writeStore(store)
  return req
}

export function approveJoinRequest(projectId: string, requestId: string, role: UserRole): void {
  const store = readStore()
  const blob = store.projects.find((p) => p.project.id === projectId)
  if (!blob) return
  const req = (blob.project.joinRequests ?? []).find((r) => r.id === requestId)
  if (!req) return
  req.status = "approved"
  req.assignedRole = role
  req.reviewedAt = new Date().toISOString()
  if (!blob.project.members) blob.project.members = []
  blob.project.members.push({
    userId: `user-${Date.now()}`,
    name: req.name,
    email: req.email,
    role,
    joinedAt: new Date().toISOString(),
  })
  writeStore(store)
}

export function rejectJoinRequest(projectId: string, requestId: string): void {
  const store = readStore()
  const blob = store.projects.find((p) => p.project.id === projectId)
  if (!blob) return
  const req = (blob.project.joinRequests ?? []).find((r) => r.id === requestId)
  if (req) {
    req.status = "rejected"
    req.reviewedAt = new Date().toISOString()
    writeStore(store)
  }
}

export function updateMemberRole(projectId: string, userId: string, role: UserRole): void {
  const store = readStore()
  const blob = store.projects.find((p) => p.project.id === projectId)
  if (!blob) return
  const member = (blob.project.members ?? []).find((m) => m.userId === userId)
  if (member) {
    member.role = role
    writeStore(store)
  }
}

export function removeMember(projectId: string, userId: string): void {
  const store = readStore()
  const blob = store.projects.find((p) => p.project.id === projectId)
  if (!blob) return
  blob.project.members = (blob.project.members ?? []).filter((m) => m.userId !== userId)
  writeStore(store)
}
