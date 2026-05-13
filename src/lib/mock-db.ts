import { Project, Stage, Task, Photo, PurchaseScheduleItem, DailyBudgetEntry, PurchaseRequest, BudgetMovement, CalendarEvent } from "@/types/project"
import { SupplyItem, AuditAlert } from "@/types/stock"
import { getActiveBlob, saveActiveBlob, ProjectBlob } from "./projects-db"

// All reads/writes go through the active project blob in projects-db.
// mock-db.ts is kept as the single public API so no other file needs to change.

function getDB(): ProjectBlob {
  return getActiveBlob()
}

function saveDB(db: ProjectBlob): void {
  saveActiveBlob(db)
}

export function getProject(): Project {
  return getDB().project
}

export function getDailyBudgetEntries(): DailyBudgetEntry[] {
  return getDB().project.dailyBudget ?? []
}

export function upsertDailyBudgetEntry(entry: DailyBudgetEntry): void {
  const db = getDB()
  if (!db.project.dailyBudget) db.project.dailyBudget = []
  const idx = db.project.dailyBudget.findIndex((e) => e.date === entry.date)
  if (idx >= 0) db.project.dailyBudget[idx] = entry
  else db.project.dailyBudget.push(entry)
  saveDB(db)
}

export function getStages(): Stage[] {
  return getDB().stages.sort((a, b) => a.order - b.order)
}

export function getStageById(id: string): Stage | undefined {
  return getDB().stages.find((s) => s.id === id)
}

export function getTasks(): Task[] {
  return getDB().tasks
}

export function getTasksByStage(stageId: string): Task[] {
  return getDB().tasks.filter((t) => t.stageId === stageId)
}

export function updateTaskStatus(
  taskId: string,
  status: "pending" | "in_progress" | "completed" | "blocked"
): void {
  const db = getDB()
  const task = db.tasks.find((t) => t.id === taskId)
  if (task) {
    task.status = status
    if (status === "completed") task.completedAt = new Date().toISOString()
    else task.completedAt = undefined
    saveDB(db)
    if (status === "completed") autoDiscountSupplies(db, taskId)
  }
}

export function updateTaskObservations(taskId: string, observations: string): void {
  const db = getDB()
  const task = db.tasks.find((t) => t.id === taskId)
  if (task) {
    task.observations = observations
    saveDB(db)
  }
}

export function addPhotoToTask(
  taskId: string,
  stageId: string,
  url: string,
  caption: string,
  uploadedBy: string
): Photo {
  const db = getDB()
  const photo: Photo = {
    id: `photo-${Date.now()}`,
    taskId,
    stageId,
    url,
    caption,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  }
  const task = db.tasks.find((t) => t.id === taskId)
  if (task) {
    task.photos.push(photo)
    db.photos.push(photo)
    saveDB(db)
  }
  return photo
}

function autoDiscountSupplies(db: ProjectBlob, taskId: string): void {
  const supplies = db.supplies.filter((s) => s.taskId === taskId && s.autoDiscountOnComplete)
  supplies.forEach((s) => {
    if (s.realQty === 0 && s.plannedQty > 0) s.realQty = s.plannedQty
  })
  saveDB(db)
}

export function getSupplies(): SupplyItem[] {
  return getDB().supplies
}

/** @internal No se usa en componentes actualmente; disponible para uso futuro. */
export function getSuppliesByStage(stageId: string): SupplyItem[] {
  return getDB().supplies.filter((s) => s.stageId === stageId)
}

export function updateSupplyRealQty(supplyId: string, realQty: number): void {
  const db = getDB()
  const supply = db.supplies.find((s) => s.id === supplyId)
  if (supply) {
    supply.realQty = realQty
    saveDB(db)
  }
}

export function updateSupplyCurrentStock(supplyId: string, currentStock: number): void {
  const db = getDB()
  const supply = db.supplies.find((s) => s.id === supplyId)
  if (supply) {
    supply.currentStock = currentStock
    saveDB(db)
  }
}

export function getAlerts(): AuditAlert[] {
  return getDB().alerts
}

export function resolveAlert(alertId: string): void {
  const db = getDB()
  const alert = db.alerts.find((a) => a.id === alertId)
  if (alert) {
    alert.status = "resolved"
    alert.resolvedAt = new Date().toISOString()
    saveDB(db)
  }
}

export function getPurchases(): PurchaseScheduleItem[] {
  return getDB().purchases
}

export function updatePurchaseStatus(
  purchaseId: string,
  status: PurchaseScheduleItem["status"]
): void {
  const db = getDB()
  const purchase = db.purchases.find((p) => p.id === purchaseId)
  if (purchase) {
    purchase.status = status
    saveDB(db)
  }
}

/** @internal No se usa en componentes actualmente; disponible para uso futuro. */
export function getUpcomingPurchases(currentWeek: number, weeksAhead = 2): PurchaseScheduleItem[] {
  return getDB().purchases.filter(
    (p) =>
      p.deliveryWeek >= currentWeek &&
      p.deliveryWeek <= currentWeek + weeksAhead &&
      p.status !== "delivered"
  )
}

export function getCriticalPurchases(): PurchaseScheduleItem[] {
  return getDB().purchases.filter((p) => p.status === "critical")
}

export function addStage(stage: Stage): void {
  const db = getDB()
  db.stages.push(stage)
  saveDB(db)
}

export function addTask(task: Task): void {
  const db = getDB()
  db.tasks.push(task)
  saveDB(db)
}

export function addSupply(supply: SupplyItem): void {
  const db = getDB()
  db.supplies.push(supply)
  saveDB(db)
}

export function addAlert(alert: AuditAlert): void {
  const db = getDB()
  db.alerts.push(alert)
  saveDB(db)
}

// ─── Purchase Requests ────────────────────────────────────────────────────────

/** Base para getPendingPurchaseRequests y getRecentResolvedRequests — preferir esas en componentes. */
export function getPurchaseRequests(): PurchaseRequest[] {
  const db = getDB()
  return (db.purchaseRequests ?? []).sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  )
}

export function getPendingPurchaseRequests(): PurchaseRequest[] {
  return getPurchaseRequests().filter((r) => r.status === "pending_approval")
}

export function getRecentResolvedRequests(limit = 10): PurchaseRequest[] {
  return getPurchaseRequests()
    .filter((r) => r.status === "approved" || r.status === "rejected")
    .slice(0, limit)
}

export function createPurchaseRequest(description: string, amount: number, requestedBy: string): void {
  if (!description.trim()) throw new Error("La descripción no puede estar vacía")
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero")
  if (!requestedBy.trim()) throw new Error("El solicitante es requerido")
  const db = getDB()
  if (!db.purchaseRequests) db.purchaseRequests = []
  db.purchaseRequests.push({
    id: `pr-${Date.now()}`,
    description: description.trim(),
    amount,
    requestedBy: requestedBy.trim(),
    requestedAt: new Date().toISOString(),
    status: "pending_approval",
  })
  saveDB(db)
}

/** Encuentra una solicitud pendiente por id; garantiza que los arrays existan. */
function findPendingRequest(db: ProjectBlob, requestId: string): import("@/types/project").PurchaseRequest | undefined {
  if (!db.purchaseRequests) db.purchaseRequests = []
  if (!db.budgetMovements) db.budgetMovements = []
  const req = db.purchaseRequests.find((r) => r.id === requestId)
  return req?.status === "pending_approval" ? req : undefined
}

export function approvePurchaseRequest(requestId: string, reviewedBy: string): void {
  const db = getDB()
  const req = findPendingRequest(db, requestId)
  if (!req) return
  req.status = "approved"
  req.reviewedBy = reviewedBy
  req.reviewedAt = new Date().toISOString()
  db.project.budgetReal = (db.project.budgetReal ?? 0) + req.amount
  const today = new Date().toISOString().slice(0, 10)
  if (!db.project.dailyBudget) db.project.dailyBudget = []
  const dayEntry = db.project.dailyBudget.find((e) => e.date === today)
  if (dayEntry) dayEntry.amount = Math.max(0, dayEntry.amount - req.amount)
  db.budgetMovements!.push({
    id: `mov-${Date.now()}`,
    description: req.description,
    amount: -req.amount,
    date: new Date().toISOString(),
    purchaseRequestId: req.id,
  })
  saveDB(db)
}

export function rejectPurchaseRequest(requestId: string, reviewedBy: string, rejectionNote?: string): void {
  const db = getDB()
  const req = findPendingRequest(db, requestId)
  if (!req) return
  req.status = "rejected"
  req.reviewedBy = reviewedBy
  req.reviewedAt = new Date().toISOString()
  req.rejectionNote = rejectionNote
  saveDB(db)
}

// ─── Budget Movements ─────────────────────────────────────────────────────────

export function getBudgetMovements(): BudgetMovement[] {
  const db = getDB()
  return (db.budgetMovements ?? []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

// ─── Stage / Supply / Purchase mutations ──────────────────────────────────────

export function updateStage(stage: Stage): void {
  const db = getDB()
  const idx = db.stages.findIndex((s) => s.id === stage.id)
  if (idx >= 0) { db.stages[idx] = stage; saveDB(db) }
}

export function deleteStage(stageId: string): void {
  const db = getDB()
  db.stages   = db.stages.filter((s) => s.id !== stageId)
  db.tasks    = db.tasks.filter((t) => t.stageId !== stageId)
  db.supplies = db.supplies.filter((s) => s.stageId !== stageId)
  db.purchases = db.purchases.filter((p) => p.stageId !== stageId)
  saveDB(db)
}

export function updateSupply(supply: SupplyItem): void {
  const db = getDB()
  const idx = db.supplies.findIndex((s) => s.id === supply.id)
  if (idx >= 0) { db.supplies[idx] = supply; saveDB(db) }
}

export function deleteSupply(supplyId: string): void {
  const db = getDB()
  db.supplies = db.supplies.filter((s) => s.id !== supplyId)
  saveDB(db)
}

export function addPurchase(purchase: PurchaseScheduleItem): void {
  const db = getDB()
  db.purchases.push(purchase)
  saveDB(db)
}

export function updatePurchase(purchase: PurchaseScheduleItem): void {
  const db = getDB()
  const idx = db.purchases.findIndex((p) => p.id === purchase.id)
  if (idx >= 0) { db.purchases[idx] = purchase; saveDB(db) }
}

export function deletePurchase(purchaseId: string): void {
  const db = getDB()
  db.purchases = db.purchases.filter((p) => p.id !== purchaseId)
  saveDB(db)
}

/** @internal Llamado internamente por el flujo de importación Excel; no exponer en UI directamente. */
export function bulkImportData(stages: Stage[], tasks: Task[], supplies: SupplyItem[]): void {
  const db = getDB()
  db.stages.push(...stages)
  db.tasks.push(...tasks)
  db.supplies.push(...supplies)
  saveDB(db)
}

export interface ProjectStageSummary {
  totalEstimatedDays: number
  totalEstimatedCost: number
  totalMaterials: number
  stagesWithEstimates: number
  completedStages: number
  totalStages: number
  stageCompletionPct: number // % de etapas completadas
}

export function getProjectStageSummary(): ProjectStageSummary {
  const db = getDB()
  const stages = db.stages
  const totalStages = stages.length
  const completedStages = stages.filter((s) => s.status === "completed").length
  const totalEstimatedDays = stages.reduce((acc, s) => acc + (s.estimatedDays ?? 0), 0)
  const totalEstimatedCost = stages.reduce((acc, s) => acc + (s.estimatedCost ?? 0), 0)
  const totalMaterials = stages.reduce((acc, s) => acc + (s.materialsCount ?? 0), 0)
  const stagesWithEstimates = stages.filter(
    (s) => s.estimatedDays != null || s.estimatedCost != null
  ).length
  const stageCompletionPct = totalStages > 0
    ? Math.round((completedStages / totalStages) * 100)
    : 0
  return {
    totalEstimatedDays,
    totalEstimatedCost,
    totalMaterials,
    stagesWithEstimates,
    completedStages,
    totalStages,
    stageCompletionPct,
  }
}

export function resetDB(): void {
  // resets only the active project — use projects-db.ts for full reset
  if (typeof window === "undefined") return
  localStorage.removeItem("obra:projects:v1")
  localStorage.removeItem("obra:active-project")
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

function weekToDate(projectStartDate: string, weekNumber: number): string {
  const start = new Date(projectStartDate + "T12:00:00")
  const result = new Date(start)
  result.setDate(start.getDate() + (weekNumber - 1) * 7)
  return result.toISOString().slice(0, 10)
}

export function getPurchaseCalendarEvents(): CalendarEvent[] {
  const db = getDB()
  const startDate = db.project.startDate
  const events: CalendarEvent[] = []
  for (const p of db.purchases) {
    if (p.status === "delivered") continue
    const needDate = weekToDate(startDate, p.deliveryWeek)
    const buyDate  = (() => {
      const d = new Date(needDate + "T12:00:00")
      d.setDate(d.getDate() - 7)
      return d.toISOString().slice(0, 10)
    })()
    events.push({
      id: `auto-need-${p.id}`,
      date: needDate,
      title: p.material,
      type: "need",
      material: p.material,
      amount: p.estimatedCost,
      purchaseId: p.id,
      createdBy: "sistema",
      createdAt: db.project.startDate,
    })
    events.push({
      id: `auto-buy-${p.id}`,
      date: buyDate,
      title: p.material,
      type: "buy",
      material: p.material,
      amount: p.estimatedCost,
      purchaseId: p.id,
      createdBy: "sistema",
      createdAt: db.project.startDate,
    })
  }
  return events
}

export function getCalendarEvents(): CalendarEvent[] {
  return getDB().calendarEvents ?? []
}

export function addCalendarEvent(event: Omit<CalendarEvent, "id" | "createdAt">): void {
  const db = getDB()
  if (!db.calendarEvents) db.calendarEvents = []
  db.calendarEvents.push({
    ...event,
    id: `cal-${Date.now()}`,
    createdAt: new Date().toISOString(),
  })
  saveDB(db)
}

/** @internal No se usa en componentes actualmente; disponible para uso futuro. */
export function updateCalendarEvent(event: CalendarEvent): void {
  const db = getDB()
  if (!db.calendarEvents) db.calendarEvents = []
  const idx = db.calendarEvents.findIndex((e) => e.id === event.id)
  if (idx >= 0) { db.calendarEvents[idx] = event; saveDB(db) }
}

export function deleteCalendarEvent(id: string): void {
  const db = getDB()
  if (!db.calendarEvents) return
  db.calendarEvents = db.calendarEvents.filter((e) => e.id !== id)
  saveDB(db)
}

export function markCalendarEventPurchased(eventId: string, purchaseRequestId: string): void {
  const db = getDB()
  if (!db.calendarEvents) return
  const ev = db.calendarEvents.find((e) => e.id === eventId)
  if (ev) { ev.purchaseRequestId = purchaseRequestId; saveDB(db) }
}

// ─── Stock Alert Calendar Events ─────────────────────────────────────────────

export function getStockAlertCalendarEvents(): CalendarEvent[] {
  const db = getDB()
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const events: CalendarEvent[] = []

  for (const supply of db.supplies) {
    const stock = supply.currentStock
    if (stock == null || stock <= 0) continue

    // Calcular consumo semanal: usar campo manual o inferir de plannedQty / semanas de etapa
    let weeklyConsumption = supply.weeklyConsumption ?? 0
    if (!weeklyConsumption) {
      const stage = db.stages.find((s) => s.id === supply.stageId)
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

    // Evitar duplicar si ya existe un evento de compra para este supply en la misma fecha
    const alreadyExists = (db.calendarEvents ?? []).some(
      (e) => e.supplyId === supply.id && e.type === "buy"
    )
    if (!alreadyExists) {
      events.push({
        id: `stock-alert-${supply.id}`,
        date: alertDateStr,
        title: supply.name,
        type: "buy",
        material: supply.name,
        supplyId: supply.id,
        deliveryDays: supply.deliveryDays ?? 7,
        createdBy: "sistema",
        createdAt: new Date().toISOString(),
      })
    }
  }
  return events
}

export function addDeliveryCalendarEvent(
  supplyId: string,
  buyDateStr: string,
  deliveryDays: number
): void {
  const db = getDB()
  const supply = db.supplies.find((s) => s.id === supplyId)
  if (!supply) return
  if (!db.calendarEvents) db.calendarEvents = []

  const buyDate = new Date(buyDateStr + "T12:00:00")
  buyDate.setDate(buyDate.getDate() + deliveryDays)
  const deliveryDateStr = buyDate.toISOString().slice(0, 10)

  // Evitar duplicados
  const exists = db.calendarEvents.some(
    (e) => e.supplyId === supplyId && e.type === "delivery"
  )
  if (!exists) {
    db.calendarEvents.push({
      id: `delivery-${supplyId}-${Date.now()}`,
      date: deliveryDateStr,
      title: supply.name,
      type: "delivery",
      material: supply.name,
      supplyId,
      deliveryDays,
      createdBy: "sistema",
      createdAt: new Date().toISOString(),
    })
    saveDB(db)
  }
}
