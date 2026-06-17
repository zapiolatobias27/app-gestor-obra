import * as XLSX from "xlsx"
import type { Stage } from "@/types/project"
import type { SupplyItem } from "@/types/stock"
import type { PdfStockResult } from "./pdf-stock-parser"

// ─── Column map ────────────────────────────────────────────────────────────────

type ColMap = {
  etapa?: number
  name?: number
  unit?: number
  neededQty?: number       // CANTIDAD NECESARIA
  stockAnterior?: number   // EN STOCK - COMPRA ANTERIOR
  toComprar?: number       // A COMPRAR
  comprado?: number        // COMPRADO (unidades compradas)
  precioEst?: number       // PRECIO ESTIMADO unitario
  precioReal?: number      // PRECIO UNIT. DE COMPRA
  totalComprado?: number   // TOTAL COMPRADO ($)
  diferencia?: number      // DIFERENCIA (ESTIMADO/COMPRADO)
  enObra?: number          // EN OBRA
  consumido?: number       // CONSUMIDO
  stock?: number           // STOCK (Comprado−Cons.)
  estado?: number          // ESTADO COMPRA
  proveedor?: number       // PROVEEDOR
  sem?: number             // SEM. PEDIDO
  obs?: number             // OBSERVACIONES
}

function buildColMap(headers: unknown[]): ColMap | null {
  const idx: ColMap = {}
  headers.forEach((h, i) => {
    const u = String(h ?? "").toUpperCase().replace(/\r?\n/g, " ").trim()
    if (u.includes("ETAPA"))                                           idx.etapa         = i
    if ((u.includes("MATERIAL") || u.includes("ÍTEM") || u.includes("ITEM")) && idx.name == null)
                                                                       idx.name          = i
    if (u === "UNIDAD" || u.startsWith("UNIDAD "))                    idx.unit          = i
    if (u.includes("CANTIDAD") && u.includes("NECESARIA"))            idx.neededQty     = i
    // "EN STOCK" con "ANTERIOR" o "COMPRA" es la columna de stock previo
    if ((u.includes("EN STOCK") || u.includes("COMPRA ANTERIOR")) && u !== "COMPRADO")
                                                                       idx.stockAnterior = i
    if (u === "A COMPRAR")                                             idx.toComprar     = i
    // "COMPRADO" exacto (no "TOTAL COMPRADO" ni "YA COMPRADOS")
    if (u === "COMPRADO" && idx.comprado == null)                      idx.comprado      = i
    if (u.includes("PRECIO ESTIMADO"))                                 idx.precioEst     = i
    // "PRECIO UNIT" o "PRECIO" + "COMPRA" = precio real de compra
    if (u.includes("PRECIO") && (u.includes("UNIT") || u.includes("COMPRA($)") || u.includes("COMPRA ($)")))
                                                                       idx.precioReal    = i
    if (u.includes("TOTAL") && u.includes("COMPRADO"))                idx.totalComprado = i
    if (u.includes("DIFERENCIA"))                                      idx.diferencia    = i
    if (u.includes("EN") && u.includes("OBRA") && !u.includes("STOCK"))
                                                                       idx.enObra        = i
    if (u === "CONSUMIDO")                                             idx.consumido     = i
    if (u.includes("STOCK") && !u.includes("EN STOCK") && !u.includes("ANTERIOR"))
                                                                       idx.stock         = i
    if (u.includes("ESTADO") && idx.estado == null)                    idx.estado        = i
    if (u.includes("PROVEEDOR"))                                       idx.proveedor     = i
    if (u.startsWith("SEM"))                                           idx.sem           = i
    if (u.includes("OBSERVACI"))                                       idx.obs           = i
  })
  return idx.name != null && idx.unit != null ? idx : null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cleanNum(s: string): number {
  const clean = s.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")
  return parseFloat(clean) || 0
}

function parseWeek(s: string): number | undefined {
  const m = s.match(/\d+/)
  if (!m) return undefined
  const n = parseInt(m[0])
  return n > 0 ? n : undefined
}

function parseStatus(s: string): SupplyItem["purchaseStatus"] {
  const v = s.toLowerCase().trim()
  if (!v || v === "—" || v === "-") return "pending"
  if (v.includes("comprado") || v.includes("entregado") || s.includes("✅") || s.includes("✓")) return "delivered"
  if (v.includes("parcial") || v.includes("curso") || s.includes("🔄")) return "ordered"
  if (v.includes("urgente") || v.includes("crít") || s.includes("⚠") || v === "!") return "critical"
  return "pending"
}

function resolveStageId(etapaCell: string, stages: Stage[]): string {
  const clean = etapaCell.trim().toUpperCase()
  if (clean && clean !== "—" && clean !== "-") {
    const match = stages.find((s) => s.code.toUpperCase() === clean)
    if (match) return match.id
  }
  return stages[0]?.id ?? "default"
}

// ─── Core row parser (exported for reuse) ─────────────────────────────────────

export function parseStockRows(
  rows: unknown[][],
  stages: Stage[],
): { supplies: SupplyItem[]; warnings: string[] } {
  const supplies: SupplyItem[] = []
  const warnings: string[] = []
  let uid = Date.now()

  type Section = "none" | "comprados" | "por_comprar"
  let section: Section = "none"
  let colMap: ColMap | null = null
  let globalColMap: ColMap | null = null

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]
    if (!row || row.length === 0) continue

    const joined = row.map((c) => String(c ?? "")).join(" ").toUpperCase()

    if (joined.includes("MATERIALES YA COMPRADOS")) {
      section = "comprados"
      colMap = globalColMap
      continue
    }
    if (joined.includes("MATERIALES POR COMPRAR")) {
      section = "por_comprar"
      colMap = globalColMap
      continue
    }
    // Header row
    if (joined.includes("MATERIAL") && joined.includes("UNIDAD")) {
      const built = buildColMap(row)
      if (built) {
        if (section === "none") section = "comprados"
        colMap = built
        if (!globalColMap) globalColMap = built
        continue
      }
    }
    if (section === "none") continue
    if (!colMap) continue

    const num = Number(row[0])
    if (!Number.isFinite(num) || num <= 0 || Math.floor(num) !== num) continue

    const g = (key: keyof ColMap) =>
      colMap![key] != null ? String(row[colMap![key]!] ?? "").trim() : ""
    const n = (key: keyof ColMap) => cleanNum(g(key))

    const name = g("name")
    if (!name) continue

    const etapa = g("etapa")
    const stageId = resolveStageId(etapa, stages)
    if (stages.length > 0 && etapa && etapa !== "—" && etapa !== "-") {
      const found = stages.find((s) => s.code.toUpperCase() === etapa.toUpperCase())
      if (!found) warnings.push(`Fila ${ri + 1}: etapa "${etapa}" no encontrada, se usó la primera etapa disponible.`)
    }
    if (stages.length === 0 && supplies.length === 0) {
      warnings.push("No hay etapas en el proyecto. Los materiales se importarán sin etapa asignada.")
    }

    const neededQty          = n("neededQty")
    const rawStockAnterior   = g("stockAnterior")
    const stockCompraAnterior = rawStockAnterior !== "" ? n("stockAnterior") : undefined
    const rawToComprar       = g("toComprar")
    const toComprar          = rawToComprar !== "" ? n("toComprar") : undefined
    const comprado           = n("comprado")
    const precioEst          = n("precioEst") || undefined
    const precioReal         = n("precioReal") || undefined
    const rawTotalComprado   = g("totalComprado")
    const totalCompradoPesos = rawTotalComprado !== "" ? n("totalComprado") : undefined
    const rawDiferencia      = g("diferencia")
    const diferenciaPesos    = rawDiferencia !== "" ? n("diferencia") : undefined
    const enObra             = n("enObra") || undefined
    const consumido          = n("consumido")
    const rawStock           = g("stock")
    const stockFinal         = rawStock !== "" ? n("stock") : undefined

    supplies.push({
      id: `sup-xlsx-${++uid}`,
      stageId,
      name,
      unit: g("unit"),
      plannedQty: neededQty,
      neededQty: neededQty || undefined,
      stockCompraAnterior,
      toComprar,
      totalPurchased: comprado,
      realQty: consumido,
      currentStock: enObra,
      estimatedUnitCost: precioEst,
      realUnitCost: precioReal,
      totalCompradoPesos,
      diferenciaPesos,
      stockFinal,
      observaciones: g("obs") || undefined,
      purchaseStatus: parseStatus(g("estado")),
      orderWeek: parseWeek(g("sem")),
      providerName: g("proveedor") || undefined,
    })
  }

  return { supplies, warnings }
}

// ─── File-based entry point ────────────────────────────────────────────────────

export async function parseMaterialsXlsx(
  file: File,
  stages: Stage[],
): Promise<PdfStockResult> {
  let rows: unknown[][]
  try {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: "array" })
    const sheetName =
      wb.SheetNames.find((n) => n.toLowerCase().includes("stock")) ?? wb.SheetNames[0]
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    })
  } catch {
    return {
      supplies: [],
      errors: [{ row: 0, message: "No se pudo leer el archivo. Verificá que sea un Excel (.xlsx) válido." }],
      warnings: [],
    }
  }

  const { supplies, warnings } = parseStockRows(rows, stages)

  if (supplies.length === 0) {
    return {
      supplies: [],
      errors: [{ row: 0, message: "No se encontraron materiales. Verificá que el archivo tenga las columnas: MATERIAL, UNIDAD, CANTIDAD NECESARIA, COMPRADO, EN OBRA, CONSUMIDO." }],
      warnings,
    }
  }

  return { supplies, errors: [], warnings }
}
