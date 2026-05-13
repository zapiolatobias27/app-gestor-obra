import { SupplyItem, AuditAlert } from "@/types/stock"

const DEVIATION_THRESHOLD = 5

export function checkDeviation(item: SupplyItem): AuditAlert | null {
  if (item.plannedQty === 0 || item.realQty === 0) return null
  const pct = ((item.realQty - item.plannedQty) / item.plannedQty) * 100
  if (Math.abs(pct) <= DEVIATION_THRESHOLD) return null
  return {
    id: `alert-${item.id}`,
    supplyItemId: item.id,
    supplyName: item.name,
    stageId: item.stageId,
    taskId: item.taskId,
    plannedQty: item.plannedQty,
    realQty: item.realQty,
    deviationPct: pct,
    severity: getDeviationSeverity(pct),
    createdAt: new Date().toISOString(),
    status: "active",
  }
}

export function checkAllDeviations(items: SupplyItem[]): AuditAlert[] {
  return items.flatMap((item) => {
    const a = checkDeviation(item)
    return a ? [a] : []
  })
}

export function formatDeviation(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`
}

export function getDeviationSeverity(pct: number): "low" | "medium" | "high" {
  const abs = Math.abs(pct)
  if (abs <= 5)  return "low"
  if (abs <= 15) return "medium"
  return "high"
}
