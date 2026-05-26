import type { Stage, Task } from "@/types/project"
import type { SupplyItem, ImportResult } from "@/types/stock"
import { parseStockRows } from "./xlsx-stock-parser"

export interface SheetData {
  name: string
  rows: unknown[][]
}

function cell(v: unknown): string {
  return String(v ?? "").trim()
}

function parseTaskStatus(s: string): "pending" | "in_progress" | "completed" | "blocked" {
  const v = s.toLowerCase()
  if (v.includes("complet")) return "completed"
  if (v.includes("proceso") || v.includes("curso")) return "in_progress"
  if (v.includes("bloq")) return "blocked"
  return "pending"
}

function parseRole(s: string): "owner" | "architect" | "supervisor" {
  const v = s.toLowerCase()
  if (v.includes("arquitect") || v.startsWith("arq")) return "architect"
  return "supervisor"
}

function toTitle(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function parseSheets(sheets: SheetData[]): ImportResult {
  const errors: { row: number; message: string }[] = []
  const stages: Stage[] = []
  const tasks: Task[] = []
  const supplies: SupplyItem[] = []
  let uid = Date.now()

  for (const { name, rows } of sheets) {
    const match = name.match(/ET\s*(\d+)/i)
    if (!match) continue
    const order = parseInt(match[1])
    const code = `ET${order}`

    // Extract stage name from title row (first 6 rows)
    let stageName = name
    for (const rawRow of rows.slice(0, 6)) {
      const joined = (rawRow as unknown[]).map((v) => cell(v)).join(" ")
      if (joined.toUpperCase().includes("ETAPA") && joined.includes("—")) {
        const after = joined.split("—").slice(1).join("—").trim()
        if (after.length > 3) {
          stageName = toTitle(after)
          break
        }
      }
    }

    // Detect column offset: handle sheets with an extra margin column at index 0
    let colOffset = 0
    for (const rawRow of rows) {
      const rowCells = (rawRow as unknown[]).map((v) => cell(v))
      const joined = rowCells.join(" ").toUpperCase()
      if (joined.includes("TAREA") && joined.includes("ACTIVIDAD")) {
        for (let i = 0; i < Math.min(4, rowCells.length); i++) {
          if (rowCells[i]) { colOffset = i; break }
        }
        break
      }
    }

    const stageId = `stage-import-${order}-${++uid}`
    stages.push({
      id: stageId,
      projectId: "", // filled by bulkImportData using the active project
      name: stageName,
      code,
      order,
      status: "pending",
    })

    let inMaterials = false
    let skipMaterialHeader = false
    let currentCategory = ""

    for (const rawRow of rows) {
      const row = rawRow as unknown[]
      const cells = row.map((v) => cell(v))
      const joined = cells.join(" ").toUpperCase()

      // Detect material section start
      if (joined.includes("PEDIDO DE MATERIALES")) {
        inMaterials = true
        skipMaterialHeader = true
        continue
      }

      // Skip material column header row
      if (inMaterials && skipMaterialHeader) {
        skipMaterialHeader = false
        continue
      }

      const c0 = cells[colOffset]
      const isTaskNum = /^\d+$/.test(c0) && parseInt(c0) > 0

      if (inMaterials) {
        if (!c0 || isTaskNum) {
          // Empty row or task number → exit material section
          inMaterials = false
          if (!c0) continue
          // fall through to task processing
        } else {
          const qty = parseFloat(String(row[2] ?? ""))
          if (!isNaN(qty) && qty > 0) {
            supplies.push({
              id: `sup-import-${++uid}`,
              stageId,
              name: cells[0],
              unit: cells[1],
              plannedQty: qty,
              realQty: 0,
              totalPurchased: 0,
            })
          }
          continue
        }
      }

      // Task row
      if (isTaskNum) {
        const title = cells[colOffset + 2]
        // Skip column header rows
        if (!title || joined.includes("TAREA") && joined.includes("ACTIVIDAD")) continue
        const cat = cells[colOffset + 1] || currentCategory
        if (cat) currentCategory = cat
        const weekStart = typeof row[colOffset + 5] === "number" ? (row[colOffset + 5] as number) : undefined
        const weekEnd = typeof row[colOffset + 6] === "number" ? (row[colOffset + 6] as number) : undefined
        tasks.push({
          id: `task-import-${++uid}`,
          stageId,
          category: currentCategory || "General",
          title,
          status: parseTaskStatus(cells[colOffset + 4]),
          responsibleRole: parseRole(cells[colOffset + 3]),
          weekStart,
          weekEnd,
          photos: [],
        })
        continue
      }

      // Category sub-header: col0 empty, col1 has text, col2 empty
      if (!c0 && cells[colOffset + 1] && !cells[colOffset + 2]) {
        currentCategory = cells[colOffset + 1]
      }
    }
  }

  if (stages.length === 0) {
    errors.push({ row: 0, message: "No se encontraron etapas en el archivo. Verificá que las hojas se llamen ET1-..., ET2-..., etc." })
  }

  // Detect stock sheet (name contains "stock" or "material" but is NOT an ET sheet)
  const stockSheet = sheets.find(
    (s) => /stock|material/i.test(s.name) && !/^ET\s*\d/i.test(s.name),
  )
  if (stockSheet) {
    const { supplies: stockSupplies, warnings: stockWarnings } = parseStockRows(
      stockSheet.rows,
      stages,
    )
    supplies.push(...stockSupplies)
    stockWarnings.forEach((w) => errors.push({ row: 0, message: `⚠ ${w}` }))
  }

  return { success: errors.length === 0, stages, tasks, supplies, errors }
}
