"use client"

import React, { useRef, useState } from "react"
import { parseMaterialsPdf } from "@/features/import/logic/pdf-stock-parser"
import { parseMaterialsXlsx } from "@/features/import/logic/xlsx-stock-parser"
import { bulkImportData } from "@/lib/mock-db"
import type { Stage } from "@/types/project"
import type { SupplyItem } from "@/types/stock"

interface PdfStockImporterProps {
  stages: Stage[]
  onImported: () => void
}

type State = "idle" | "parsing" | "preview" | "importing" | "done" | "error"

const PURCHASE_STATUS_LABEL: Record<NonNullable<SupplyItem["purchaseStatus"]>, string> = {
  pending:   "Por comprar",
  ordered:   "Pedido",
  delivered: "Comprado",
  critical:  "Urgente",
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)
}

export function PdfStockImporter({ stages, onImported }: PdfStockImporterProps) {
  const [state, setState] = useState<State>("idle")
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setState("idle")
    setSupplies([])
    setWarnings([])
    setErrorMsg("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleFile = async (file: File) => {
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx")
    const isPdf  = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isXlsx && !isPdf) {
      setErrorMsg("El archivo debe ser un Excel (.xlsx) o PDF.")
      setState("error")
      return
    }
    setState("parsing")
    try {
      const result = isXlsx
        ? await parseMaterialsXlsx(file, stages)
        : await parseMaterialsPdf(file, stages)
      if (result.errors.length > 0 && result.supplies.length === 0) {
        setErrorMsg(result.errors.map((e) => e.message).join(" "))
        setState("error")
        return
      }
      setSupplies(result.supplies)
      setWarnings(result.warnings)
      setState("preview")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al leer el PDF.")
      setState("error")
    }
  }

  const handleImport = async () => {
    setState("importing")
    try {
      await bulkImportData([], [], supplies)
      setState("done")
      onImported()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al importar.")
      setState("error")
    }
  }

  // ─── Idle ──────────────────────────────────────────────────────────────────

  if (state === "idle") {
    return (
      <div className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors
            ${dragOver ? "border-stone-400 bg-stone-100" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"}`}
        >
          <svg width="36" height="36" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-stone-400">
            <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" />
            <text x="4" y="12.5" fontSize="4" fontWeight="bold" fill="currentColor" fontFamily="sans-serif" opacity=".9">XLS</text>
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-stone-700">Arrastrá o hacé click para subir el archivo</p>
            <p className="text-xs text-stone-500 mt-0.5">Excel (.xlsx) recomendado · PDF como alternativa</p>
            <p className="text-xs text-stone-400 mt-0.5">Google Sheets → Archivo → Descargar → Microsoft Excel (.xlsx)</p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
    )
  }

  // ─── Parsing ───────────────────────────────────────────────────────────────

  if (state === "parsing") {
    return (
      <div className="flex items-center justify-center gap-3 py-10">
        <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-stone-500">Leyendo archivo…</span>
      </div>
    )
  }

  // ─── Importing ─────────────────────────────────────────────────────────────

  if (state === "importing") {
    return (
      <div className="flex items-center justify-center gap-3 py-10">
        <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-stone-500">Guardando {supplies.length} materiales…</span>
      </div>
    )
  }

  // ─── Done ──────────────────────────────────────────────────────────────────

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-600" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-semibold text-stone-800">{supplies.length} materiales importados</p>
          <p className="text-xs text-stone-400 mt-1">Ya aparecen en la planilla</p>
        </div>
        <button type="button" className="proj-btn-ghost-sm" onClick={reset}>Importar otro PDF</button>
      </div>
    )
  }

  // ─── Error ─────────────────────────────────────────────────────────────────

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-600" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-red-600 text-center max-w-sm">{errorMsg}</p>
        <button type="button" className="proj-btn-ghost-sm" onClick={reset}>Intentar de nuevo</button>
      </div>
    )
  }

  // ─── Preview ───────────────────────────────────────────────────────────────

  const delivered = supplies.filter((s) => s.purchaseStatus === "delivered").length
  const pending   = supplies.filter((s) => s.purchaseStatus === "pending" || !s.purchaseStatus).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
          <span className="text-lg font-bold text-blue-700">{supplies.length}</span>
          <span className="text-xs text-blue-600">materiales</span>
        </div>
        {delivered > 0 && (
          <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
            <span className="text-lg font-bold text-green-700">{delivered}</span>
            <span className="text-xs text-green-600">ya comprados</span>
          </div>
        )}
        {pending > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg">
            <span className="text-lg font-bold text-amber-700">{pending}</span>
            <span className="text-xs text-amber-600">por comprar</span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.slice(0, 3).map((w, i) => (
            <p key={i} className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">{w}</p>
          ))}
          {warnings.length > 3 && (
            <p className="text-xs text-amber-500">… y {warnings.length - 3} advertencias más</p>
          )}
        </div>
      )}

      {/* Mini table preview */}
      <div className="overflow-x-auto border border-stone-100 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Material</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Unidad</th>
              <th className="text-right px-3 py-2 font-medium text-stone-500">Comprado</th>
              <th className="text-right px-3 py-2 font-medium text-stone-500 hidden sm:table-cell">Precio unit.</th>
              <th className="text-center px-3 py-2 font-medium text-stone-500">Estado</th>
            </tr>
          </thead>
          <tbody>
            {supplies.slice(0, 10).map((s, i) => (
              <tr key={i} className="border-t border-stone-50 hover:bg-stone-50">
                <td className="px-3 py-1.5 font-medium text-stone-800 max-w-[180px] truncate">{s.name}</td>
                <td className="px-3 py-1.5 text-stone-500">{s.unit}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{s.totalPurchased || s.plannedQty}</td>
                <td className="px-3 py-1.5 text-right tabular-nums hidden sm:table-cell">
                  {s.estimatedUnitCost ? fmt(s.estimatedUnitCost) : "—"}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {s.purchaseStatus ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.purchaseStatus === "delivered" ? "badge-done" :
                      s.purchaseStatus === "ordered"   ? "badge-progress" :
                      s.purchaseStatus === "critical"  ? "badge-blocked" :
                      "badge-pending"
                    }`}>
                      {PURCHASE_STATUS_LABEL[s.purchaseStatus]}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {supplies.length > 10 && (
          <p className="text-xs text-stone-400 text-center py-2">
            … y {supplies.length - 10} materiales más
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button type="button" className="proj-btn-primary" onClick={handleImport}>
          Importar {supplies.length} materiales
        </button>
        <button type="button" className="proj-btn-ghost-sm" onClick={reset}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
