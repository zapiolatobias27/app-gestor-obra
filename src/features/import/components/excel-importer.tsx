"use client"

import React, { useRef, useState } from "react"
import { parseSheets, SheetData } from "@/features/import/logic/excel-parser"
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

      const etSheets = wb.SheetNames.filter((n) => /^ET\d/i.test(n))
      if (etSheets.length === 0) {
        setErrorMsg("No se encontraron hojas de etapas. Las hojas deben llamarse ET1-..., ET2-..., etc.")
        setState("error")
        return
      }

      const sheets: SheetData[] = etSheets.map((name) => ({
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

  const handleImport = async () => {
    if (!result) return
    setImporting(true)
    try {
      await bulkImportData(result.stages, result.tasks, result.supplies)
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
          {result?.stages.length} etapas · {result?.tasks.length} tareas · {result?.supplies.length} insumos cargados
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
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card stat-card-accent-blue">
            <p className="stat-card-label">Etapas</p>
            <p className="stat-card-value">{result.stages.length}</p>
          </div>
          <div className="stat-card stat-card-accent-blue">
            <p className="stat-card-label">Tareas</p>
            <p className="stat-card-value">{result.tasks.length}</p>
          </div>
          <div className="stat-card stat-card-accent-blue">
            <p className="stat-card-label">Insumos</p>
            <p className="stat-card-value">{result.supplies.length}</p>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
            <p className="text-sm font-semibold text-orange-700">Advertencias ({result.errors.length})</p>
            {result.errors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-xs text-orange-600">Fila {e.row}: {e.message}</p>
            ))}
            {result.errors.length > 5 && (
              <p className="text-xs text-orange-500">... y {result.errors.length - 5} más</p>
            )}
          </div>
        )}

        <div className="bg-stone-50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
          {result.stages.map((s) => {
            const stageTasks = result.tasks.filter((t) => t.stageId === s.id)
            const stageSupplies = result.supplies.filter((sup) => sup.stageId === s.id)
            return (
              <div key={s.id} className="flex items-center justify-between text-sm py-1 border-b border-stone-100 last:border-0">
                <span className="font-medium text-stone-800">
                  <span className="text-stone-400 mr-1.5">{s.code}</span>{s.name}
                </span>
                <span className="text-stone-400 text-xs tabular-nums">
                  {stageTasks.length} tareas · {stageSupplies.length} insumos
                </span>
              </div>
            )
          })}
        </div>

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
      <p className="text-xs text-stone-300 mt-3">Formato: .xlsx · Hojas: ET1-..., ET2-..., etc.</p>
    </div>
  )
}
