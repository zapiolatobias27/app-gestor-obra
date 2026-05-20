"use client"

import { createClient } from "@/lib/supabase/client"
import { getActiveProjectId } from "./projects-db"
import type { Project, Stage, Task, Photo, PurchaseScheduleItem, DailyBudgetEntry, PurchaseRequest, BudgetMovement, CalendarEvent, Invoice } from "@/types/project"
import type { SupplyItem, AuditAlert } from "@/types/stock"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function projectId(): string {
  return getActiveProjectId()
}

// ─── Mappers snake_case → camelCase ──────────────────────────────────────────

function mapStage(r: Record<string, unknown>): Stage {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    code: r.code as string,
    order: r.order as number,
    status: r.status as Stage["status"],
    assignedTo: r.assigned_to as string | undefined,
    startDate: r.start_date as string | undefined,
    endDate: r.end_date as string | undefined,
    weekStart: r.week_start as number | undefined,
    weekEnd: r.week_end as number | undefined,
    estimatedDays: r.estimated_days as number | undefined,
    estimatedCost: r.estimated_cost as number | undefined,
    materialsCount: r.materials_count as number | undefined,
  }
}

function mapTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    stageId: r.stage_id as string,
    category: r.category as string,
    title: r.title as string,
    description: r.description as string | undefined,
    status: r.status as Task["status"],
    responsibleRole: r.responsible_role as Task["responsibleRole"],
    responsibleId: r.responsible_id as string | undefined,
    weekStart: r.week_start as number | undefined,
    weekEnd: r.week_end as number | undefined,
    startDate: r.start_date as string | undefined,
    endDate: r.end_date as string | undefined,
    observations: r.observations as string | undefined,
    completedAt: r.completed_at as string | undefined,
    photos: [],
  }
}

function mapPhoto(r: Record<string, unknown>): Photo {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    stageId: r.stage_id as string,
    url: r.url as string,
    caption: r.caption as string | undefined,
    uploadedBy: r.uploaded_by as string,
    uploadedAt: r.uploaded_at as string,
  }
}

function mapSupply(r: Record<string, unknown>): SupplyItem {
  return {
    id: r.id as string,
    stageId: r.stage_id as string,
    taskId: r.task_id as string | undefined,
    name: r.name as string,
    unit: r.unit as string,
    plannedQty: r.planned_qty as number,
    realQty: r.real_qty as number,
    currentStock: r.current_stock as number | undefined,
    weeklyConsumption: r.weekly_consumption as number | undefined,
    deliveryDays: r.delivery_days as number | undefined,
    providerId: r.provider_id as string | undefined,
    estimatedUnitCost: r.estimated_unit_cost as number | undefined,
    realUnitCost: r.real_unit_cost as number | undefined,
    autoDiscountOnComplete: r.auto_discount_on_complete as boolean | undefined,
  }
}

function mapAlert(r: Record<string, unknown>): AuditAlert {
  return {
    id: r.id as string,
    supplyItemId: r.supply_item_id as string,
    supplyName: r.supply_name as string,
    taskId: r.task_id as string | undefined,
    stageId: r.stage_id as string,
    plannedQty: r.planned_qty as number,
    realQty: r.real_qty as number,
    deviationPct: r.deviation_pct as number,
    severity: r.severity as AuditAlert["severity"],
    createdAt: r.created_at as string,
    resolvedAt: r.resolved_at as string | undefined,
    status: r.status as AuditAlert["status"],
  }
}

function mapPurchase(r: Record<string, unknown>): PurchaseScheduleItem {
  return {
    id: r.id as string,
    stageId: r.stage_id as string,
    taskId: r.task_id as string | undefined,
    material: r.material as string,
    unit: r.unit as string,
    quantity: r.quantity as number,
    deliveryWeek: r.delivery_week as number,
    status: r.status as PurchaseScheduleItem["status"],
    supplierId: r.supplier_id as string | undefined,
    estimatedCost: r.estimated_cost as number,
    realCost: r.real_cost as number | undefined,
    notes: r.notes as string | undefined,
  }
}

function mapPurchaseRequest(r: Record<string, unknown>): PurchaseRequest {
  return {
    id: r.id as string,
    description: r.description as string,
    amount: r.amount as number,
    requestedBy: r.requested_by as string,
    requestedAt: r.requested_at as string,
    status: r.status as PurchaseRequest["status"],
    reviewedBy: r.reviewed_by as string | undefined,
    reviewedAt: r.reviewed_at as string | undefined,
    rejectionNote: r.rejection_note as string | undefined,
  }
}

function mapBudgetMovement(r: Record<string, unknown>): BudgetMovement {
  return {
    id: r.id as string,
    description: r.description as string,
    amount: r.amount as number,
    date: r.date as string,
    purchaseRequestId: r.purchase_request_id as string | undefined,
  }
}

function mapCalendarEvent(r: Record<string, unknown>): CalendarEvent {
  return {
    id: r.id as string,
    date: r.date as string,
    title: r.title as string,
    type: r.type as CalendarEvent["type"],
    material: r.material as string | undefined,
    amount: r.amount as number | undefined,
    purchaseRequestId: r.purchase_request_id as string | undefined,
    purchaseId: r.purchase_id as string | undefined,
    supplyId: r.supply_id as string | undefined,
    deliveryDays: r.delivery_days as number | undefined,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
  }
}

function mapDailyBudget(r: Record<string, unknown>): DailyBudgetEntry {
  return {
    date: r.date as string,
    amount: r.amount as number,
    note: r.note as string | undefined,
  }
}

// ─── Project ──────────────────────────────────────────────────────────────────

export async function getProject(): Promise<Project | null> {
  const id = projectId()
  if (!id) return null
  const supabase = createClient()
  const { data } = await supabase.from("projects").select("*").eq("id", id).single()
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    client: data.client,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    budgetEstimated: data.budget_estimated,
    budgetReal: data.budget_real,
    inviteCode: data.invite_code,
  }
}

// ─── Daily Budget ─────────────────────────────────────────────────────────────

export async function getDailyBudgetEntries(): Promise<DailyBudgetEntry[]> {
  const supabase = createClient()
  const { data } = await supabase.from("daily_budget").select("*").eq("project_id", projectId()).order("date", { ascending: false })
  return (data ?? []).map(mapDailyBudget)
}

export async function upsertDailyBudgetEntry(entry: DailyBudgetEntry): Promise<void> {
  const supabase = createClient()
  await supabase.from("daily_budget").upsert({
    project_id: projectId(),
    date: entry.date,
    amount: entry.amount,
    note: entry.note,
  }, { onConflict: "project_id,date" })
}

// ─── Stages ───────────────────────────────────────────────────────────────────

export async function getStages(): Promise<Stage[]> {
  const supabase = createClient()
  const { data } = await supabase.from("stages").select("*").eq("project_id", projectId()).order("order", { ascending: true })
  return (data ?? []).map(mapStage)
}

export async function getStageById(id: string): Promise<Stage | undefined> {
  const supabase = createClient()
  const { data } = await supabase.from("stages").select("*").eq("id", id).single()
  return data ? mapStage(data) : undefined
}

export async function addStage(stage: Stage): Promise<void> {
  const supabase = createClient()
  await supabase.from("stages").insert({
    id: stage.id,
    project_id: projectId(),
    name: stage.name,
    code: stage.code,
    order: stage.order,
    status: stage.status,
    assigned_to: stage.assignedTo,
    start_date: stage.startDate,
    end_date: stage.endDate,
    week_start: stage.weekStart,
    week_end: stage.weekEnd,
    estimated_days: stage.estimatedDays,
    estimated_cost: stage.estimatedCost,
    materials_count: stage.materialsCount,
  })
}

export async function updateStage(stage: Stage): Promise<void> {
  const supabase = createClient()
  await supabase.from("stages").update({
    name: stage.name,
    code: stage.code,
    order: stage.order,
    status: stage.status,
    assigned_to: stage.assignedTo,
    start_date: stage.startDate,
    end_date: stage.endDate,
    week_start: stage.weekStart,
    week_end: stage.weekEnd,
    estimated_days: stage.estimatedDays,
    estimated_cost: stage.estimatedCost,
    materials_count: stage.materialsCount,
  }).eq("id", stage.id)
}

export async function deleteStage(stageId: string): Promise<void> {
  const supabase = createClient()
  // Las tablas relacionadas se borran por CASCADE en la DB
  await supabase.from("stages").delete().eq("id", stageId)
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  const supabase = createClient()
  const stages = await getStages()
  const stageIds = stages.map((s) => s.id)
  if (stageIds.length === 0) return []
  const { data } = await supabase.from("tasks").select("*").in("stage_id", stageIds)
  return (data ?? []).map(mapTask)
}

export async function getTasksByStage(stageId: string): Promise<Task[]> {
  const supabase = createClient()
  const { data } = await supabase.from("tasks").select("*").eq("stage_id", stageId)
  return (data ?? []).map(mapTask)
}

export async function addTask(task: Task): Promise<void> {
  const supabase = createClient()
  await supabase.from("tasks").insert({
    id: task.id,
    stage_id: task.stageId,
    category: task.category,
    title: task.title,
    description: task.description,
    status: task.status,
    responsible_role: task.responsibleRole,
    responsible_id: task.responsibleId,
    week_start: task.weekStart,
    week_end: task.weekEnd,
    start_date: task.startDate,
    end_date: task.endDate,
    observations: task.observations,
    completed_at: task.completedAt,
  })
}

export async function updateTaskStatus(taskId: string, status: Task["status"]): Promise<void> {
  const supabase = createClient()
  const completedAt = status === "completed" ? new Date().toISOString() : null
  await supabase.from("tasks").update({ status, completed_at: completedAt }).eq("id", taskId)

  if (status === "completed") {
    const { data: supplies } = await supabase
      .from("supply_items")
      .select("*")
      .eq("task_id", taskId)
      .eq("auto_discount_on_complete", true)
    for (const s of supplies ?? []) {
      if (s.real_qty === 0 && s.planned_qty > 0) {
        await supabase.from("supply_items").update({ real_qty: s.planned_qty }).eq("id", s.id)
      }
    }
  }
}

export async function updateTaskObservations(taskId: string, observations: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("tasks").update({ observations }).eq("id", taskId)
}

export async function addPhotoToTask(taskId: string, stageId: string, url: string, caption: string, uploadedBy: string): Promise<Photo> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("photos")
    .insert({ task_id: taskId, stage_id: stageId, url, caption, uploaded_by: uploadedBy })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return mapPhoto(data)
}

// ─── Supplies ─────────────────────────────────────────────────────────────────

export async function getSupplies(): Promise<SupplyItem[]> {
  const supabase = createClient()
  const stages = await getStages()
  const stageIds = stages.map((s) => s.id)
  if (stageIds.length === 0) return []
  const { data } = await supabase.from("supply_items").select("*").in("stage_id", stageIds)
  return (data ?? []).map(mapSupply)
}

export async function getSuppliesByStage(stageId: string): Promise<SupplyItem[]> {
  const supabase = createClient()
  const { data } = await supabase.from("supply_items").select("*").eq("stage_id", stageId)
  return (data ?? []).map(mapSupply)
}

export async function addSupply(supply: SupplyItem): Promise<void> {
  const supabase = createClient()
  await supabase.from("supply_items").insert({
    id: supply.id,
    stage_id: supply.stageId,
    task_id: supply.taskId,
    name: supply.name,
    unit: supply.unit,
    planned_qty: supply.plannedQty,
    real_qty: supply.realQty,
    current_stock: supply.currentStock,
    weekly_consumption: supply.weeklyConsumption,
    delivery_days: supply.deliveryDays,
    provider_id: supply.providerId,
    estimated_unit_cost: supply.estimatedUnitCost,
    real_unit_cost: supply.realUnitCost,
    auto_discount_on_complete: supply.autoDiscountOnComplete ?? false,
  })
}

export async function updateSupply(supply: SupplyItem): Promise<void> {
  const supabase = createClient()
  await supabase.from("supply_items").update({
    name: supply.name,
    unit: supply.unit,
    planned_qty: supply.plannedQty,
    real_qty: supply.realQty,
    current_stock: supply.currentStock,
    weekly_consumption: supply.weeklyConsumption,
    delivery_days: supply.deliveryDays,
    estimated_unit_cost: supply.estimatedUnitCost,
    real_unit_cost: supply.realUnitCost,
    auto_discount_on_complete: supply.autoDiscountOnComplete ?? false,
  }).eq("id", supply.id)
}

export async function updateSupplyRealQty(supplyId: string, realQty: number): Promise<void> {
  const supabase = createClient()
  await supabase.from("supply_items").update({ real_qty: realQty }).eq("id", supplyId)
}

export async function updateSupplyCurrentStock(supplyId: string, currentStock: number): Promise<void> {
  const supabase = createClient()
  await supabase.from("supply_items").update({ current_stock: currentStock }).eq("id", supplyId)
}

export async function deleteSupply(supplyId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("supply_items").delete().eq("id", supplyId)
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function getAlerts(): Promise<AuditAlert[]> {
  const supabase = createClient()
  const stages = await getStages()
  const stageIds = stages.map((s) => s.id)
  if (stageIds.length === 0) return []
  const { data } = await supabase.from("audit_alerts").select("*").in("stage_id", stageIds).order("created_at", { ascending: false })
  return (data ?? []).map(mapAlert)
}

export async function addAlert(alert: AuditAlert): Promise<void> {
  const supabase = createClient()
  await supabase.from("audit_alerts").insert({
    id: alert.id,
    supply_item_id: alert.supplyItemId,
    supply_name: alert.supplyName,
    task_id: alert.taskId,
    stage_id: alert.stageId,
    planned_qty: alert.plannedQty,
    real_qty: alert.realQty,
    deviation_pct: alert.deviationPct,
    severity: alert.severity,
    status: alert.status,
  })
}

export async function resolveAlert(alertId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("audit_alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", alertId)
}

// ─── Purchases ────────────────────────────────────────────────────────────────

export async function getPurchases(): Promise<PurchaseScheduleItem[]> {
  const supabase = createClient()
  const stages = await getStages()
  const stageIds = stages.map((s) => s.id)
  if (stageIds.length === 0) return []
  const { data } = await supabase.from("purchase_schedule").select("*").in("stage_id", stageIds)
  return (data ?? []).map(mapPurchase)
}

export async function addPurchase(purchase: PurchaseScheduleItem): Promise<void> {
  const supabase = createClient()
  await supabase.from("purchase_schedule").insert({
    id: purchase.id,
    stage_id: purchase.stageId,
    task_id: purchase.taskId,
    material: purchase.material,
    unit: purchase.unit,
    quantity: purchase.quantity,
    delivery_week: purchase.deliveryWeek,
    status: purchase.status,
    supplier_id: purchase.supplierId,
    estimated_cost: purchase.estimatedCost,
    real_cost: purchase.realCost,
    notes: purchase.notes,
  })
}

export async function updatePurchase(purchase: PurchaseScheduleItem): Promise<void> {
  const supabase = createClient()
  await supabase.from("purchase_schedule").update({
    stage_id: purchase.stageId,
    task_id: purchase.taskId ?? null,
    material: purchase.material,
    unit: purchase.unit,
    quantity: purchase.quantity,
    delivery_week: purchase.deliveryWeek,
    status: purchase.status,
    estimated_cost: purchase.estimatedCost,
    real_cost: purchase.realCost,
    notes: purchase.notes,
  }).eq("id", purchase.id)
}

export async function updatePurchaseStatus(purchaseId: string, status: PurchaseScheduleItem["status"]): Promise<void> {
  const supabase = createClient()
  await supabase.from("purchase_schedule").update({ status }).eq("id", purchaseId)
}

export async function deletePurchase(purchaseId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("purchase_schedule").delete().eq("id", purchaseId)
}

export async function getCriticalPurchases(): Promise<PurchaseScheduleItem[]> {
  const supabase = createClient()
  const stages = await getStages()
  const stageIds = stages.map((s) => s.id)
  if (stageIds.length === 0) return []
  const { data } = await supabase.from("purchase_schedule").select("*").in("stage_id", stageIds).eq("status", "critical")
  return (data ?? []).map(mapPurchase)
}

// ─── Purchase Requests ────────────────────────────────────────────────────────

export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
  const supabase = createClient()
  const { data } = await supabase.from("purchase_requests").select("*").eq("project_id", projectId()).order("requested_at", { ascending: false })
  return (data ?? []).map(mapPurchaseRequest)
}

export async function getPendingPurchaseRequests(): Promise<PurchaseRequest[]> {
  const supabase = createClient()
  const { data } = await supabase.from("purchase_requests").select("*").eq("project_id", projectId()).eq("status", "pending_approval").order("requested_at", { ascending: false })
  return (data ?? []).map(mapPurchaseRequest)
}

export async function getRecentResolvedRequests(limit = 10): Promise<PurchaseRequest[]> {
  const supabase = createClient()
  const { data } = await supabase.from("purchase_requests").select("*").eq("project_id", projectId()).in("status", ["approved", "rejected"]).order("reviewed_at", { ascending: false }).limit(limit)
  return (data ?? []).map(mapPurchaseRequest)
}

export async function createPurchaseRequest(description: string, amount: number, requestedBy: string): Promise<void> {
  if (!description.trim()) throw new Error("La descripción no puede estar vacía")
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero")
  if (!requestedBy.trim()) throw new Error("El solicitante es requerido")
  const supabase = createClient()
  await supabase.from("purchase_requests").insert({
    project_id: projectId(),
    description: description.trim(),
    amount,
    requested_by: requestedBy.trim(),
    status: "pending_approval",
  })
}

export async function approvePurchaseRequest(requestId: string, reviewedBy: string): Promise<void> {
  const supabase = createClient()
  const { data: req } = await supabase.from("purchase_requests").select("*").eq("id", requestId).eq("status", "pending_approval").single()
  if (!req) return

  const now = new Date().toISOString()
  await supabase.from("purchase_requests").update({ status: "approved", reviewed_by: reviewedBy, reviewed_at: now }).eq("id", requestId)

  const { data: project } = await supabase.from("projects").select("budget_real").eq("id", projectId()).single()
  await supabase.from("projects").update({ budget_real: (project?.budget_real ?? 0) + req.amount }).eq("id", projectId())

  const today = now.slice(0, 10)
  const { data: dayEntry } = await supabase.from("daily_budget").select("*").eq("project_id", projectId()).eq("date", today).single()
  if (dayEntry) {
    await supabase.from("daily_budget").update({ amount: Math.max(0, dayEntry.amount - req.amount) }).eq("id", dayEntry.id)
  }

  await supabase.from("budget_movements").insert({
    project_id: projectId(),
    description: req.description,
    amount: -req.amount,
    purchase_request_id: req.id,
  })
}

export async function rejectPurchaseRequest(requestId: string, reviewedBy: string, rejectionNote?: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("purchase_requests").update({
    status: "rejected",
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    rejection_note: rejectionNote,
  }).eq("id", requestId)
}

// ─── Budget Movements ─────────────────────────────────────────────────────────

export async function getBudgetMovements(): Promise<BudgetMovement[]> {
  const supabase = createClient()
  const { data } = await supabase.from("budget_movements").select("*").eq("project_id", projectId()).order("date", { ascending: false })
  return (data ?? []).map(mapBudgetMovement)
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

export async function bulkImportData(stages: Stage[], tasks: Task[], supplies: SupplyItem[]): Promise<void> {
  const supabase = createClient()
  const pid = projectId()
  if (!pid) throw new Error("No hay un proyecto activo. Creá o seleccioná un proyecto antes de importar.")

  if (stages.length > 0) {
    const { error } = await supabase.from("stages").insert(stages.map((s) => ({
      id: s.id, project_id: pid, name: s.name, code: s.code, order: s.order,
      status: s.status, week_start: s.weekStart, week_end: s.weekEnd,
      estimated_days: s.estimatedDays, estimated_cost: s.estimatedCost,
    })))
    if (error) throw new Error(`Error al importar etapas: ${error.message}`)
  }
  if (tasks.length > 0) {
    const { error } = await supabase.from("tasks").insert(tasks.map((t) => ({
      id: t.id, stage_id: t.stageId, category: t.category, title: t.title,
      status: t.status, responsible_role: t.responsibleRole,
      week_start: t.weekStart, week_end: t.weekEnd,
    })))
    if (error) throw new Error(`Error al importar tareas: ${error.message}`)
  }
  if (supplies.length > 0) {
    const { error } = await supabase.from("supply_items").insert(supplies.map((s) => ({
      id: s.id, stage_id: s.stageId, task_id: s.taskId, name: s.name,
      unit: s.unit, planned_qty: s.plannedQty, real_qty: s.realQty,
      estimated_unit_cost: s.estimatedUnitCost,
      auto_discount_on_complete: s.autoDiscountOnComplete ?? false,
    })))
    if (error) throw new Error(`Error al importar insumos: ${error.message}`)
  }
}

// ─── Project Summary ──────────────────────────────────────────────────────────

export interface ProjectStageSummary {
  totalEstimatedDays: number
  totalEstimatedCost: number
  totalMaterials: number
  stagesWithEstimates: number
  completedStages: number
  totalStages: number
  stageCompletionPct: number
}

export async function getProjectStageSummary(): Promise<ProjectStageSummary> {
  const stages = await getStages()
  const totalStages = stages.length
  const completedStages = stages.filter((s) => s.status === "completed").length
  const totalEstimatedDays = stages.reduce((acc, s) => acc + (s.estimatedDays ?? 0), 0)
  const totalEstimatedCost = stages.reduce((acc, s) => acc + (s.estimatedCost ?? 0), 0)
  const totalMaterials = stages.reduce((acc, s) => acc + (s.materialsCount ?? 0), 0)
  const stagesWithEstimates = stages.filter((s) => s.estimatedDays != null || s.estimatedCost != null).length
  const stageCompletionPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0
  return { totalEstimatedDays, totalEstimatedCost, totalMaterials, stagesWithEstimates, completedStages, totalStages, stageCompletionPct }
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

function weekToDate(projectStartDate: string, weekNumber: number): string {
  const start = new Date(projectStartDate + "T12:00:00")
  start.setDate(start.getDate() + (weekNumber - 1) * 7)
  return start.toISOString().slice(0, 10)
}

export async function getPurchaseCalendarEvents(): Promise<CalendarEvent[]> {
  const project = await getProject()
  if (!project) return []
  const purchases = await getPurchases()
  const events: CalendarEvent[] = []

  for (const p of purchases) {
    if (p.status === "delivered") continue
    if (!p.deliveryWeek || p.deliveryWeek <= 0) continue
    const needBase = new Date(weekToDate(project.startDate, p.deliveryWeek) + "T12:00:00")
    const buyBase  = new Date(needBase)
    buyBase.setDate(buyBase.getDate() - 7)

    for (let i = 0; i < 7; i++) {
      const buyDay  = new Date(buyBase);  buyDay.setDate(buyBase.getDate()  + i)
      const needDay = new Date(needBase); needDay.setDate(needBase.getDate() + i)
      events.push({ id: `auto-buy-${p.id}-d${i}`,  date: buyDay.toISOString().slice(0, 10),  title: p.material, type: "buy",  material: p.material, amount: p.estimatedCost, purchaseId: p.id, createdBy: "sistema", createdAt: project.startDate })
      events.push({ id: `auto-need-${p.id}-d${i}`, date: needDay.toISOString().slice(0, 10), title: p.material, type: "need", material: p.material, amount: p.estimatedCost, purchaseId: p.id, createdBy: "sistema", createdAt: project.startDate })
    }
  }
  return events
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = createClient()
  const { data } = await supabase.from("calendar_events").select("*").eq("project_id", projectId()).order("date", { ascending: true })
  return (data ?? []).map(mapCalendarEvent)
}

export async function addCalendarEvent(event: Omit<CalendarEvent, "id" | "createdAt">): Promise<void> {
  const supabase = createClient()
  await supabase.from("calendar_events").insert({
    project_id: projectId(),
    date: event.date,
    title: event.title,
    type: event.type,
    material: event.material,
    amount: event.amount,
    purchase_request_id: event.purchaseRequestId,
    purchase_id: event.purchaseId,
    supply_id: event.supplyId,
    delivery_days: event.deliveryDays,
    created_by: event.createdBy,
  })
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("calendar_events").delete().eq("id", id)
}

export async function markCalendarEventPurchased(eventId: string, purchaseRequestId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("calendar_events").update({ purchase_request_id: purchaseRequestId }).eq("id", eventId)
}

export async function getStockAlertCalendarEvents(): Promise<CalendarEvent[]> {
  const supplies = await getSupplies()
  const stages = await getStages()
  const existingEvents = await getCalendarEvents()
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const events: CalendarEvent[] = []

  for (const supply of supplies) {
    const stock = supply.currentStock
    if (stock == null || stock <= 0) continue
    let weeklyConsumption = supply.weeklyConsumption ?? 0
    if (!weeklyConsumption) {
      const stage = stages.find((s) => s.id === supply.stageId)
      if (stage && stage.weekStart != null && stage.weekEnd != null) {
        const durationWeeks = Math.max(1, stage.weekEnd - stage.weekStart)
        weeklyConsumption = supply.plannedQty / durationWeeks
      }
    }
    if (!weeklyConsumption || weeklyConsumption <= 0) continue
    const weeksLeft = stock / weeklyConsumption
    const alertDate = new Date(today)
    alertDate.setDate(today.getDate() + Math.floor(weeksLeft * 7))
    const alertDateStr = alertDate.toISOString().slice(0, 10)
    const alreadyExists = existingEvents.some((e) => e.supplyId === supply.id && e.type === "buy")
    if (!alreadyExists) {
      events.push({ id: `stock-alert-${supply.id}`, date: alertDateStr, title: supply.name, type: "buy", material: supply.name, supplyId: supply.id, deliveryDays: supply.deliveryDays ?? 7, createdBy: "sistema", createdAt: new Date().toISOString() })
    }
  }
  return events
}

export async function addDeliveryCalendarEvent(supplyId: string, buyDateStr: string, deliveryDays: number): Promise<void> {
  const supabase = createClient()
  const { data: supply } = await supabase.from("supply_items").select("name").eq("id", supplyId).single()
  if (!supply) return
  const existingEvents = await getCalendarEvents()
  const exists = existingEvents.some((e) => e.supplyId === supplyId && e.type === "delivery")
  if (exists) return

  const buyDate = new Date(buyDateStr + "T12:00:00")
  buyDate.setDate(buyDate.getDate() + deliveryDays)

  await supabase.from("calendar_events").insert({
    project_id: projectId(),
    date: buyDate.toISOString().slice(0, 10),
    title: supply.name,
    type: "delivery",
    material: supply.name,
    supply_id: supplyId,
    delivery_days: deliveryDays,
    created_by: "sistema",
  })
}

export async function resetDB(): Promise<void> {
  if (typeof window === "undefined") return
  localStorage.removeItem("obra:active-project")
}

export async function getInvoiceDueDateCalendarEvents(): Promise<CalendarEvent[]> {
  const invoices = await getInvoices()
  return invoices
    .filter((inv) => inv.dueDate && inv.status !== "paid")
    .map((inv) => ({
      id: `invoice-${inv.id}`,
      date: inv.dueDate!,
      title: inv.supplier + (inv.invoiceNumber ? ` · N°${inv.invoiceNumber}` : ""),
      type: "invoice" as const,
      amount: inv.amount,
      invoiceId: inv.id,
      createdBy: "",
      createdAt: "",
    }))
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function mapInvoice(r: Record<string, unknown>): Invoice {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    supplier: r.supplier as string,
    description: (r.description as string | null) ?? undefined,
    amount: r.amount as number,
    date: r.date as string,
    dueDate: (r.due_date as string | null) ?? undefined,
    status: r.status as Invoice["status"],
    invoiceNumber: (r.invoice_number as string | null) ?? undefined,
    photoUrl: (r.photo_url as string | null) ?? undefined,
    notes: (r.notes as string | null) ?? undefined,
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  const supabase = createClient()
  const pid = projectId()
  if (!pid) return []
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("project_id", pid)
    .order("date", { ascending: false })
  return (data ?? []).map(mapInvoice)
}

export async function addInvoice(invoice: Invoice): Promise<void> {
  const supabase = createClient()
  const pid = projectId()
  const { error } = await supabase.from("invoices").insert({
    id: invoice.id,
    project_id: pid,
    supplier: invoice.supplier,
    description: invoice.description ?? "",
    amount: invoice.amount,
    date: invoice.date,
    due_date: invoice.dueDate ?? null,
    status: invoice.status,
    invoice_number: invoice.invoiceNumber ?? null,
    photo_url: invoice.photoUrl ?? null,
    notes: invoice.notes ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function updateInvoice(invoice: Invoice): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("invoices").update({
    supplier: invoice.supplier,
    description: invoice.description,
    amount: invoice.amount,
    date: invoice.date,
    due_date: invoice.dueDate ?? null,
    status: invoice.status,
    invoice_number: invoice.invoiceNumber ?? null,
    photo_url: invoice.photoUrl ?? null,
    notes: invoice.notes ?? null,
  }).eq("id", invoice.id)
  if (error) throw new Error(error.message)
}

export async function updateInvoiceStatus(id: string, status: Invoice["status"]): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteInvoice(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("invoices").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
