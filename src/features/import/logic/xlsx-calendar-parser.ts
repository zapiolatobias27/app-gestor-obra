import * as XLSX from "xlsx"

export interface ParsedCalendarItem {
  material: string
  unit: string
  qty: string
  estimatedUnitCost: number
  totalCost: number
  providerName: string
  buyWeek: number
  buyDate: string        // YYYY-MM-DD calculado desde semana, o "" si no hay
  deliveryDays: number
  fechaLimite: string
  statusRaw: string
  etapa: string
  observaciones: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanNum(s: string): number {
  if (typeof s === "number") return s as number
  const clean = String(s).replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")
  return parseFloat(clean) || 0
}

function parseDeliveryDays(s: string): number {
  // "3–5 días" → 4, "24–48 hs" → 2, "7 días" → 7, "Inmediato" → 0
  if (!s || s.toLowerCase().includes("inmed")) return 0
  const nums = s.match(/\d+/g)
  if (!nums) return 0
  if (nums.length >= 2) return Math.round((parseInt(nums[0]) + parseInt(nums[1])) / 2)
  const n = parseInt(nums[0])
  // Si es horas, convertir a días
  if (s.toLowerCase().includes("hs") || s.toLowerCase().includes("hora")) return Math.ceil(n / 24)
  return n
}

function weekToDate(projectStartDate: string, weekNumber: number): string {
  const start = new Date(projectStartDate + "T12:00:00")
  start.setDate(start.getDate() + (weekNumber - 1) * 7)
  return start.toISOString().slice(0, 10)
}

type ColMap = {
  num?: number
  etapa?: number
  material?: number
  unit?: number
  qty?: number
  pu?: number
  total?: number
  proveedor?: number
  semCompra?: number
  plazo?: number
  fechaLimite?: number
  precioFijo?: number
  estado?: number
  obs?: number
}

function buildColMap(headers: unknown[]): ColMap | null {
  const idx: ColMap = {}
  headers.forEach((h, i) => {
    const u = String(h ?? "").toUpperCase().replace(/\r?\n/g, " ").trim()
    if (u === "#")                                                     idx.num       = i
    if (u.includes("ETAPA"))                                           idx.etapa     = i
    if ((u.includes("MATERIAL") || u.includes("ÍTEM") || u.includes("ITEM")) && idx.material == null)
                                                                       idx.material  = i
    if (u === "UNIDAD")                                                idx.unit      = i
    if (u.includes("CANT"))                                            idx.qty       = i
    if ((u.includes("P.U") || u.includes("PRECIO") || u.includes("P. U")) && !u.includes("FIJO"))
                                                                       idx.pu        = i
    if (u.includes("TOTAL"))                                           idx.total     = i
    if (u.includes("PROVEEDOR"))                                       idx.proveedor = i
    if (u.includes("SEM") && (u.includes("COMPRA") || u.includes("COMPRA")))
                                                                       idx.semCompra = i
    if (u.includes("PLAZO"))                                           idx.plazo     = i
    if (u.includes("FECHA") || u.includes("LÍMITE") || u.includes("LIMITE"))
                                                                       idx.fechaLimite = i
    if (u.includes("FIJO"))                                            idx.precioFijo = i
    if (u.includes("ESTADO"))                                          idx.estado    = i
    if (u.includes("OBSERVACI"))                                       idx.obs       = i
  })
  return idx.material != null ? idx : null
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export async function parseCalendarXlsx(
  file: File,
  projectStartDate: string,
): Promise<{ items: ParsedCalendarItem[]; errors: string[] }> {
  let rows: unknown[][]
  try {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false })

    // Buscar hoja de calendario: nombre incluye "calend" o "compra", ignorar hojas ET*
    const sheetName = wb.SheetNames.find(
      (n) => /calend|compra/i.test(n) && !/^ET\s*\d/i.test(n),
    )
    console.log("[CAL PARSER] Hojas:", wb.SheetNames, "→ usando:", sheetName)
    if (!sheetName) {
      return {
        items: [],
        errors: ["No se encontró una hoja de Calendario de Compras. Verificá que el archivo tenga la hoja '🛒 Calendario Compras'."],
      }
    }

    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    })
  } catch {
    return {
      items: [],
      errors: ["No se pudo leer el archivo. Verificá que sea un Excel (.xlsx) válido."],
    }
  }

  const items: ParsedCalendarItem[] = []
  const errors: string[] = []
  let colMap: ColMap | null = null

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]
    if (!row || row.length === 0) continue

    const joined = row.map((c) => String(c ?? "")).join(" ").toUpperCase()

    // Detectar fila de header — solo si todavía no la encontramos (evita que filas de datos
    // cuyo nombre de material contiene "MATERIAL" o "SEM" reseteen el colMap)
    if (!colMap && joined.includes("MATERIAL") && (joined.includes("SEM") || joined.includes("UNIDAD"))) {
      const built = buildColMap(row)
      if (built) {
        colMap = built
        console.log("[CAL PARSER] Header en fila", ri, "→ colMap:", JSON.stringify(colMap))
        continue
      }
    }

    if (!colMap) continue

    // Solo filas con número entero positivo en la primera columna
    const num = Number(row[0])
    if (!Number.isFinite(num) || num <= 0 || Math.floor(num) !== num) continue

    const g = (key: keyof ColMap) =>
      colMap![key] != null ? String(row[colMap![key]!] ?? "").trim() : ""
    const n = (key: keyof ColMap) => cleanNum(g(key))

    const material = g("material")
    if (!material) continue

    const semRaw = colMap.semCompra != null ? row[colMap.semCompra] : undefined
    const buyWeek = Math.round(n("semCompra"))
    const startForCalc = projectStartDate || new Date().toISOString().slice(0, 10)
    const buyDate = buyWeek > 0 ? weekToDate(startForCalc, buyWeek) : ""

    if (items.length < 3) {
      console.log("[CAL PARSER] Row", ri, "- semRaw:", semRaw, "- buyWeek:", buyWeek, "- startDate:", startForCalc, "- buyDate:", buyDate)
    }

    items.push({
      material,
      unit: g("unit"),
      qty: g("qty"),
      estimatedUnitCost: n("pu"),
      totalCost: n("total"),
      providerName: g("proveedor"),
      buyWeek,
      buyDate,
      deliveryDays: parseDeliveryDays(g("plazo")),
      fechaLimite: g("fechaLimite"),
      statusRaw: g("estado"),
      etapa: g("etapa"),
      observaciones: g("obs"),
    })
  }

  if (items.length === 0) {
    errors.push("No se encontraron ítems en la hoja de Calendario de Compras.")
  }

  const withoutDate = items.filter((i) => !i.buyDate).length
  if (withoutDate > 0 && withoutDate === items.length) {
    errors.push(`Advertencia: no se pudo calcular la fecha de compra para ningún ítem (columna SEM.COMPRA no detectada o sin fecha de inicio del proyecto).`)
  } else if (withoutDate > 0) {
    errors.push(`${withoutDate} ítems sin fecha de compra (se importarán en la fecha de hoy).`)
  }

  return { items, errors }
}
