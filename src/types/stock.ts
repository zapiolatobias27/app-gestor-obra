export interface SupplyItem {
  id: string
  stageId: string
  taskId?: string
  name: string
  unit: string
  plannedQty: number         // = neededQty (CANTIDAD NECESARIA del proyecto)
  realQty: number            // consumido
  currentStock?: number      // EN OBRA (ingresado al obrador)
  totalPurchased: number     // COMPRADO (unidades compradas)
  weeklyConsumption?: number
  deliveryDays?: number
  orderWeek?: number
  purchaseStatus?: "pending" | "ordered" | "delivered" | "critical"
  providerId?: string
  providerName?: string
  estimatedUnitCost?: number // PRECIO ESTIMADO unitario
  realUnitCost?: number      // PRECIO REAL DE COMPRA unitario
  photoUrl?: string
  autoDiscountOnComplete?: boolean
  // Campos extendidos del Excel
  neededQty?: number         // CANTIDAD NECESARIA
  stockCompraAnterior?: number // EN STOCK - COMPRA ANTERIOR
  toComprar?: number         // A COMPRAR
  totalCompradoPesos?: number  // TOTAL COMPRADO ($)
  diferenciaPesos?: number   // DIFERENCIA (estimado vs comprado)
  stockFinal?: number        // STOCK (Comprado − Consumido)
  observaciones?: string
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
