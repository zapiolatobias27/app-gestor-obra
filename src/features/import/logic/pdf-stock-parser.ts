import type { Stage } from "@/types/project"
import type { SupplyItem } from "@/types/stock"

export interface PdfStockResult {
  supplies: SupplyItem[]
  errors: { row: number; message: string }[]
  warnings: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanNum(s: string): number {
  // "$ 4.740" → 4740 | "1.236" → 1236 | "20.833,50" → 20833.5
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
  if (v.includes("parcial") || v.includes("curso") || v.includes("pedido") || s.includes("🔄")) return "ordered"
  if (v.includes("urgente") || v.includes("crít") || s.includes("⚠") || s === "!") return "critical"
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

// ─── Raw item extraction ──────────────────────────────────────────────────────

type RawItem = { str: string; x: number; y: number }

async function extractRawItems(file: File): Promise<RawItem[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf" as string) as typeof import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const items: RawItem[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    for (const item of tc.items as Array<{ str: string; transform: number[] }>) {
      const s = item.str.trim()
      if (s) {
        items.push({ str: s, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) })
      }
    }
  }
  return items
}

// Group raw items into rows by Y coordinate (tolerance ±5px), sorted top-down then left-right
function groupIntoRows(items: RawItem[]): RawItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: RawItem[][] = []
  let currentY: number | null = null
  let currentRow: RawItem[] = []
  const Y_TOL = 5

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) > Y_TOL) {
      if (currentRow.length > 0) rows.push([...currentRow].sort((a, b) => a.x - b.x))
      currentRow = [item]
      currentY = item.y
    } else {
      currentRow.push(item)
    }
  }
  if (currentRow.length > 0) rows.push([...currentRow].sort((a, b) => a.x - b.x))
  return rows
}

// ─── Column bucket assignment ─────────────────────────────────────────────────

// Assigns each item to the nearest column center and concatenates values within the same bucket.
// This handles "$" being extracted as a separate pdfjs token — it falls in the same bucket as its number.
function assignToBuckets(items: RawItem[], colCenters: number[]): string[] {
  const cols: string[][] = colCenters.map(() => [])
  for (const item of items) {
    const ci = colCenters.reduce(
      (best, cx, i) => (Math.abs(item.x - cx) < Math.abs(item.x - colCenters[best]) ? i : best),
      0,
    )
    cols[ci].push(item.str)
  }
  return cols.map((c) => c.join(" ").trim())
}

// Detect the 14 column centers from the header row containing "COMPRADO" and ("PRECIO" or "UNIDAD")
function detectColCenters(rows: RawItem[][]): number[] | null {
  for (const row of rows) {
    const joined = row.map((i) => i.str).join(" ").toUpperCase()
    if (joined.includes("COMPRADO") && (joined.includes("PRECIO") || joined.includes("UNIDAD"))) {
      if (row.length >= 5) {
        return row.map((i) => i.x)
      }
    }
  }
  return null
}

// ─── Fallback: merge "$" tokens and use fixed column indices ─────────────────

function mergeDollarTokens(items: RawItem[]): RawItem[] {
  const out = [...items]
  for (let i = out.length - 2; i >= 0; i--) {
    if (out[i].str.trim() === "$") {
      out[i + 1] = { ...out[i + 1], str: "$ " + out[i + 1].str }
      out.splice(i, 1)
    }
  }
  return out
}

// ─── Row classification ───────────────────────────────────────────────────────

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toUpperCase()
  return (
    joined.includes("MATERIAL") ||
    joined.includes("UNIDAD") ||
    joined.includes("ETAPA") ||
    joined.includes("SUBTOTAL") ||
    joined.includes("INSTRUCCIONES") ||
    joined.includes("COLUMNA") ||
    joined.includes("COMPRADO TOTAL") ||
    joined.includes("CANT NECESARIA")
  )
}

function isDataRow(cells: string[]): boolean {
  return /^\d+$/.test(cells[0]) && parseInt(cells[0]) > 0
}

// ─── Main parse function ───────────────────────────────────────────────────────

export async function parseMaterialsPdf(
  file: File,
  stages: Stage[],
): Promise<PdfStockResult> {
  const supplies: SupplyItem[] = []
  const errors: { row: number; message: string }[] = []
  const warnings: string[] = []
  let uid = Date.now()

  let allItems: RawItem[]
  try {
    allItems = await extractRawItems(file)
  } catch {
    return {
      supplies: [],
      errors: [{ row: 0, message: "No se pudo leer el PDF. Verificá que sea un PDF válido." }],
      warnings: [],
    }
  }

  const rowsRaw = groupIntoRows(allItems)
  const colCenters = detectColCenters(rowsRaw)

  type Section = "none" | "comprados" | "por_comprar"
  let section: Section = "none"

  for (let ri = 0; ri < rowsRaw.length; ri++) {
    const rowItems = rowsRaw[ri]
    if (rowItems.length === 0) continue

    // Raw text (X order, no bucket assignment) — required for section/header detection.
    // Bucket assignment spreads multi-word phrases across empty buckets, breaking .includes() checks.
    const rawJoined = rowItems.map((i) => i.str).join(" ").toUpperCase()

    if (rawJoined.includes("MATERIALES YA COMPRADOS") ||
        (rawJoined.includes("YA COMPRADOS") && !rawJoined.includes("POR COMPRAR"))) {
      section = "comprados"
      continue
    }
    if (rawJoined.includes("MATERIALES POR COMPRAR")) {
      section = "por_comprar"
      continue
    }
    if (section === "none") continue
    if (isHeaderRow(rowItems.map((i) => i.str))) continue

    // Bucket assignment for data rows only (handles multi-word names and split "$" tokens)
    let cells: string[]
    if (colCenters) {
      cells = assignToBuckets(rowItems, colCenters)
    } else {
      const merged = mergeDollarTokens(rowItems)
      cells = merged.map((i) => i.str)
    }

    if (!isDataRow(cells)) continue
    if (cells.length < 5) continue

    const etapaRaw = cells[1] ?? "—"
    const name     = cells[2] ?? ""
    const unit     = cells[3] ?? ""

    if (!name.trim()) continue

    const stageId = resolveStageId(etapaRaw, stages)
    if (stageId === "default" && stages.length > 0 && etapaRaw.trim() !== "—" && etapaRaw.trim() !== "-") {
      warnings.push(`Fila ${ri + 1}: etapa "${etapaRaw}" no encontrada, se usó la primera etapa disponible.`)
    }
    if (stages.length === 0 && supplies.length === 0) {
      warnings.push("No hay etapas en el proyecto. Todos los materiales se importarán sin etapa asignada.")
    }

    // Unified column mapping — same for both sections:
    // [0]=#  [1]=etapa  [2]=material  [3]=unidad  [4]=qty  [5]=precio  [6]=total(skip)
    // [7]=en_obra  [8]=consumido  [9]=stock(skip)  [10]=estado  [11]=proveedor  [12]=sem  [13]=obs(skip)
    const qty      = cells.length > 4  ? cleanNum(cells[4])  : 0
    const precio   = cells.length > 5  ? cleanNum(cells[5])  : 0
    const enObra   = cells.length > 7  ? cleanNum(cells[7])  : 0
    const consumido = cells.length > 8 ? cleanNum(cells[8])  : 0
    const estadoCell = cells.length > 10 ? cells[10] : ""
    const semCell    = cells.length > 12 ? cells[12] : ""

    supplies.push({
      id: `sup-pdf-${++uid}`,
      stageId,
      name: name.trim(),
      unit: unit.trim(),
      plannedQty: qty,
      totalPurchased: section === "comprados" ? qty : 0,
      realQty: consumido,
      currentStock: enObra > 0 ? enObra : undefined,
      estimatedUnitCost: precio > 0 ? precio : undefined,
      purchaseStatus: parseStatus(estadoCell),
      orderWeek: parseWeek(semCell),
    })
  }

  if (supplies.length === 0 && errors.length === 0) {
    errors.push({
      row: 0,
      message: "No se encontraron materiales en el PDF. Verificá que el archivo tenga el formato correcto con las secciones 'MATERIALES YA COMPRADOS' o 'MATERIALES POR COMPRAR'.",
    })
  }

  return { supplies, errors, warnings }
}
