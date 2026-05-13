export interface SupplyItem {
  id: string
  stageId: string
  taskId?: string
  name: string
  unit: string
  plannedQty: number
  realQty: number
  currentStock?: number      // unidades físicas disponibles hoy en obra
  weeklyConsumption?: number // unidades consumidas por semana (manual o calculado)
  deliveryDays?: number      // días de plazo del proveedor para este insumo
  providerId?: string
  estimatedUnitCost?: number
  realUnitCost?: number
  autoDiscountOnComplete?: boolean
}

export interface AuditAlert {
  id: string
  supplyItemId: string
  supplyName: string
  taskId?: string
  stageId: string
  plannedQty: number
  realQty: number
  deviationPct: number
  severity: "low" | "medium" | "high"
  createdAt: string
  resolvedAt?: string
  status: "active" | "resolved"
}

export interface ExcelImportRow {
  etapa: string
  tarea: string
  insumo: string
  cantidad: number
  unidad: string
}

export interface ImportError {
  row: number
  message: string
}

export interface ImportResult {
  success: boolean
  stages: import("@/types/project").Stage[]
  tasks: import("@/types/project").Task[]
  supplies: SupplyItem[]
  errors: ImportError[]
}
