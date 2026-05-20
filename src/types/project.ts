export type ProjectStatus = "planning" | "in_progress" | "paused" | "completed"
export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked"
// UserRole is the single source of truth in @/types/user — re-exported here for backwards compat
import type { UserRole } from "@/types/user"
export type { UserRole }

export interface ProjectMember {
  userId: string
  name: string
  email: string
  role: UserRole
  joinedAt: string
}

export interface JoinRequest {
  id: string
  name: string
  email: string
  requestedAt: string
  status: "pending" | "approved" | "rejected"
  assignedRole?: UserRole
  reviewedAt?: string
  userId?: string
}

export interface InviteCode {
  code: string
  projectId: string
  createdAt: string
  createdBy: string
}

export interface DailyBudgetEntry {
  date: string   // ISO date "YYYY-MM-DD"
  amount: number // disponible en caja ese día
  note?: string
}

export interface Project {
  id: string
  name: string
  address: string
  client: string
  startDate: string
  endDate?: string
  status: ProjectStatus
  budgetEstimated: number
  budgetReal: number
  dailyBudget?: DailyBudgetEntry[]
  members?: ProjectMember[]
  joinRequests?: JoinRequest[]
  inviteCode?: string
}

export interface Stage {
  id: string
  projectId: string
  name: string
  code: string // ET1..ET8
  order: number
  status: TaskStatus
  assignedTo?: string
  startDate?: string
  endDate?: string
  weekStart?: number
  weekEnd?: number
  estimatedDays?: number   // duración estimada en días
  estimatedCost?: number   // costo estimado en ARS
  materialsCount?: number  // cantidad de materiales requeridos
}

export interface Task {
  id: string
  stageId: string
  category: string
  title: string
  description?: string
  status: TaskStatus
  responsibleRole: UserRole
  responsibleId?: string
  weekStart?: number
  weekEnd?: number
  startDate?: string
  endDate?: string
  observations?: string
  photos: Photo[]
  completedAt?: string
}

export interface Photo {
  id: string
  projectId?: string
  taskId?: string
  stageId?: string
  url: string
  caption?: string
  uploadedBy: string
  uploadedAt: string
}

export interface PurchaseScheduleItem {
  id: string
  stageId: string
  taskId?: string
  material: string
  unit: string
  quantity: number
  deliveryWeek: number
  status: "pending" | "ordered" | "delivered" | "critical"
  supplierId?: string
  estimatedCost: number
  realCost?: number
  notes?: string
}

export type PurchaseRequestStatus = "pending_approval" | "approved" | "rejected"

export interface PurchaseRequest {
  id: string
  description: string   // ej: "Cemento Portland 50 bolsas"
  amount: number        // monto en ARS
  requestedBy: string   // nombre del encargado
  requestedAt: string   // ISO datetime
  status: PurchaseRequestStatus
  reviewedBy?: string   // nombre del arquitecto/propietario que aprobó/rechazó
  reviewedAt?: string
  rejectionNote?: string
}

export interface CalendarEvent {
  id: string
  date: string              // "YYYY-MM-DD"
  title: string
  type: "buy" | "need" | "note" | "delivery" | "invoice"
  material?: string
  amount?: number
  purchaseRequestId?: string // si ya se hizo el pedido
  purchaseId?: string        // si viene de PurchaseScheduleItem (auto)
  supplyId?: string          // si viene de alerta de stock bajo
  deliveryDays?: number      // días de plazo del proveedor
  invoiceId?: string         // si viene de vencimiento de factura
  createdBy: string
  createdAt: string
}

export interface BudgetMovement {
  id: string
  description: string   // ej: "Compra cemento"
  amount: number        // negativo = egreso
  date: string          // ISO datetime
  purchaseRequestId?: string
}

export interface Invoice {
  id: string
  projectId: string
  supplier: string
  description?: string
  amount: number
  date: string              // YYYY-MM-DD
  dueDate?: string          // YYYY-MM-DD
  status: "pending" | "paid" | "overdue"
  invoiceNumber?: string
  photoUrl?: string
  notes?: string
}
