"use client"

import React, { useRef, useState } from "react"
import { parseSheets, applyMerges, SheetData } from "@/features/import/logic/excel-parser"
import { bulkImportData } from "@/lib/mock-db"
import type { ImportResult } from "@/types/stock"

type State = "idle" | "preview" | "done" | "error"

export function ExcelImporter({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>("idle")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [mergesOpen, setMergesOpen] = useState(false)
  const [disabledMerges, setDisabledMerges] = useState<Set<number>>(new Set())

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setErrorMsg("El archivo debe ser un Excel (.xlsx o .xls)")
      setState("error")
      return
    }

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })

      const etSheets = wb.SheetNames.filter((n) => /^ET\s*\d/i.test(n))
      if (etSheets.length === 0) {
        setErrorMsg("No se encontraron hojas de etapas. Las hojas deben llamarse ET1-..., ET2-..., etc.")
        setState("error")
        return
      }

      // Include all sheets: ET sheets + optional stock sheet
      const relevantSheets = wb.SheetNames.filter(
        (n) => /^ET\s*\d/i.test(n) || /stock|material/i.test(n),
      )
      const sheets: SheetData[] = relevantSheets.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" }),
      }))

      const parsed = parseSheets(sheets)
      setResult(parsed)
      setState("preview")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al leer el archivo")
      setState("error")
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const toggleMerge = (i: number) =>
    setDisabledMerges((prev) => {
      const next = new Set(prev)
      if (next.has(i)) { next.delete(i) } else { next.add(i) }
      return next
    })

  const handleImport = async () => {
    if (!result) return
    setImporting(true)
    try {
      const finalSupplies = applyMerges(result.supplies, result.merges, disabledMerges)
      await bulkImportData(result.stages, result.tasks, finalSupplies)
      setState("done")
      onImported?.()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al importar")
      setState("error")
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setState("idle")
    setResult(null)
    setErrorMsg("")
    setMergesOpen(false)
    setDisabledMerges(new Set())
  }

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-stone-900">Importación completada</p>
        <p className="text-sm text-stone-500">
          {result?.stages.length} etapas · {result?.tasks.length} tareas · {(result ? result.supplies.length + disabledMerges.size : 0)} materiales cargados
        </p>
        <button type="button" className="proj-btn-ghost-sm mt-2" onClick={reset}>
          Importar otro archivo
        </button>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="font-semibold text-stone-900">No se pudo procesar el archivo</p>
        <p className="text-sm text-red-600 max-w-sm">{errorMsg}</p>
        <button type="button" className="proj-btn-ghost-sm mt-2" onClick={reset}>
          Intentar de nuevo
        </button>
      </div>
    )
  }

  if (state === "preview" && result) {
    const etSupplies    = result.supplies.filter((s) => s.id.startsWith("sup-import"))
    const stockSupplies = result.supplies.filter((s) => s.id.startsWith("sup-xlsx"))
    const comprados     = stockSupplies.filter((s) => s.purchaseStatus === "delivered")
    const porComprar    = stockSupplies.filter((s) => s.purchaseStatus !== "delivered")

    const toggleStage = (id: string) =>
      setExpandedStages((prev) => {
        const next = new Set(prev)
        if (next.has(id)) { next.delete(id) } else { next.add(id) }
        return next
      })

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className={`grid gap-3 ${stockSupplies.length > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
          <div className="stat-card stat-card-accent-blue">
            <p className="stat-card-label">Etapas</p>
            <p className="stat-card-value">{result.stages.length}</p>
          </div>
          <div className="stat-card stat-card-accent-blue">
            <p className="stat-card-label">Tareas</p>
            <p className="stat-card-value">{result.tasks.length}</p>
          </div>
          <div className="stat-card stat-card-accent-blue">
            <p className="stat-card-label">Insumos ET</p>
            <p className="stat-card-value">{etSupplies.length}</p>
          </div>
          {stockSupplies.length > 0 && (
            <div className="stat-card stat-card-accent-blue">
              <p className="stat-card-label">Stock</p>
              <p className="stat-card-value">{stockSupplies.length}</p>
            </div>
          )}
        </div>

        {/* Warnings */}
        {result.errors.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
            <p className="text-sm font-semibold text-orange-700">Advertencias ({result.errors.length})</p>
            {result.errors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-xs text-orange-600">Fila {e.row}: {e.message}</p>
            ))}
            {result.errors.length > 5 && (
              <p className="text-xs text-orange-500">… y {result.errors.length - 5} más</p>
            )}
          </div>
        )}

        {/* Fusiones de materiales duplicados (etapa ↔ lista de Stock) */}
        {result.merges.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <button
              type="button"
              className="w-full flex items-center justify-between text-left"
              onClick={() => setMergesOpen((v) => !v)}
            >
              <span className="text-sm font-semibold text-blue-800">
                {result.merges.length - disabledMerges.size} de {result.merges.length} materiales se fusionarán con los de las etapas
              </span>
              <svg
                className={`w-4 h-4 text-blue-500 transition-transform ${mergesOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <p className="text-xs text-blue-600 mt-0.5">
              Son los mismos materiales que ya vienen en las etapas. Tocá &quot;No fusionar&quot; para importarlo como ítem aparte.
            </p>
            {mergesOpen && (
              <div className="mt-2 space-y-1 max-h-64 overflow-auto">
                {result.merges.map((m, i) => {
                  const off = disabledMerges.has(i)
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 bg-white rounded-md px-2.5 py-1.5 border border-blue-100">
                      <div className="min-w-0 text-xs">
                        <span className="text-stone-800 font-medium">{m.stock.name}</span>
                        <span className="text-stone-400">{off ? " · se importa aparte" : ` → ${m.etName}`}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleMerge(i)}
                        className={`shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                          off
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {off ? "Fusionar" : "No fusionar"}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Etapas expandibles */}
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Etapas y tareas</p>
          <div className="border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-100">
            {result.stages.map((s) => {
              const stageTasks = result.tasks.filter((t) => t.stageId === s.id)
              const stageEtInsumos = etSupplies.filter((sup) => sup.stageId === s.id)
              const isExpanded = expandedStages.has(s.id)
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 text-left transition-colors"
                    onClick={() => toggleStage(s.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{s.code}</span>
                      <span className="text-sm font-medium text-stone-800">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-400">
                        {stageTasks.length} tareas{stageEtInsumos.length > 0 ? ` · ${stageEtInsumos.length} insumos` : ""}
                      </span>
                      <svg
                        className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && stageTasks.length > 0 && (
                    <div className="bg-stone-50 border-t border-stone-100 px-4 py-1.5 space-y-0">
                      {stageTasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-1.5 text-xs border-b border-stone-100 last:border-0">
                          <span className="text-stone-700 truncate pr-3">{t.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {t.weekStart != null && (
                              <span className="text-stone-400">
                                Sem {t.weekStart}{t.weekEnd != null && t.weekEnd !== t.weekStart ? `–${t.weekEnd}` : ""}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded font-medium ${
                              t.status === "completed"  ? "bg-green-100 text-green-700" :
                              t.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                              t.status === "blocked"     ? "bg-red-100 text-red-600" :
                              "bg-stone-100 text-stone-500"
                            }`}>
                              {t.status === "completed"   ? "Completa"  :
                               t.status === "in_progress" ? "En curso"  :
                               t.status === "blocked"     ? "Bloqueada" : "Pendiente"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabla de materiales de stock */}
        {stockSupplies.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Materiales de stock</p>
              <div className="flex gap-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{comprados.length} ya comprados</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{porComprar.length} por comprar</span>
              </div>
            </div>
            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <div className="overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 sticky top-0 z-10">
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="text-left px-3 py-2 font-medium">Material</th>
                      <th className="text-left px-3 py-2 font-medium">Unid.</th>
                      <th className="text-right px-3 py-2 font-medium">Cant.</th>
                      <th className="text-right px-3 py-2 font-medium">P. Unit.</th>
                      <th className="text-left px-3 py-2 font-medium">Estado</th>
                      <th className="text-left px-3 py-2 font-medium">Proveedor</th>
                      <th className="text-right px-3 py-2 font-medium">Sem.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {stockSupplies.map((s) => {
                      const isComprado = s.purchaseStatus === "delivered"
                      return (
                        <tr key={s.id} className={isComprado ? "bg-green-50/50" : "bg-yellow-50/30"}>
                          <td className="px-3 py-1.5 text-stone-800 max-w-[180px] truncate" title={s.name}>{s.name}</td>
                          <td className="px-3 py-1.5 text-stone-500">{s.unit}</td>
                          <td className="px-3 py-1.5 text-stone-700 text-right tabular-nums">
                            {(s.totalPurchased || s.plannedQty).toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-1.5 text-stone-700 text-right tabular-nums">
                            {s.estimatedUnitCost ? `$${s.estimatedUnitCost.toLocaleString("es-AR")}` : "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded font-medium ${
                              isComprado ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {isComprado ? "Comprado" : "Por comprar"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-stone-500 max-w-[120px] truncate" title={s.providerName ?? ""}>
                            {s.providerName ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-stone-500 text-right">
                            {s.orderWeek ? `Sem. ${s.orderWeek}` : "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="proj-btn-primary"
          >
            {importing ? "Importando…" : "Importar todo"}
          </button>
          <button type="button" className="proj-btn-ghost" onClick={reset}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // Idle state — drop zone
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
        dragging
          ? "border-clay-400 bg-clay-50"
          : "border-stone-300 hover:border-clay-300 hover:bg-stone-50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />
      <svg className="w-10 h-10 mx-auto mb-3 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="font-semibold text-stone-600">Arrastrá tu Excel acá</p>
      <p className="text-sm text-stone-400 mt-1">o hacé click para seleccionar el archivo</p>
      <p className="text-xs text-stone-300 mt-3">Formato: .xlsx · Hojas: ET1, ET2… + hoja de Stock (opcional)</p>
    </div>
  )
}
