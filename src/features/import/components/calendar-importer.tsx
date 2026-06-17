"use client"

import React, { useRef, useState } from "react"
import { parseCalendarXlsx, ParsedCalendarItem } from "@/features/import/logic/xlsx-calendar-parser"
import { addCalendarEvent } from "@/lib/mock-db"

interface Props {
  projectStartDate: string
  onImported: () => void
}

type State = "idle" | "parsing" | "preview" | "importing" | "done" | "error"

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function CalendarImporter({ projectStartDate, onImported }: Props) {
  const [state, setState] = useState<State>("idle")
  const [items, setItems]  = useState<ParsedCalendarItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setState("idle")
    setItems([])
    setErrors([])
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErrors(["El archivo debe ser un Excel (.xlsx)."])
      setState("error")
      return
    }
    setState("parsing")
    try {
      const startDate = projectStartDate || new Date().toISOString().slice(0, 10)
      const result = await parseCalendarXlsx(file, startDate)
      if (result.errors.length > 0 && result.items.length === 0) {
        setErrors(result.errors)
        setState("error")
        return
      }
      setItems(result.items)
      setErrors(result.errors)
      setState("preview")
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Error al leer el archivo."])
      setState("error")
    }
  }

  const handleImport = async () => {
    setState("importing")
    const today = new Date().toISOString().slice(0, 10)
    try {
      for (const item of items) {
        await addCalendarEvent({
          date: item.buyDate || today,
          title: item.material,
          type: "buy",
          material: item.material,
          amount: item.totalCost || item.estimatedUnitCost || undefined,
          createdBy: "excel-import",
        })
      }
      setState("done")
      onImported()
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Error al importar."])
      setState("error")
    }
  }

  // ─── Idle ──────────────────────────────────────────────────────────────────

  if (state === "idle") {
    return (
      <div className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors
            ${dragging ? "border-stone-400 bg-stone-100" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"}`}
        >
          <svg width="36" height="36" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-stone-400">
            <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" />
            <text x="4" y="12.5" fontSize="4" fontWeight="bold" fill="currentColor" fontFamily="sans-serif" opacity=".9">XLS</text>
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-stone-700">Arrastrá o hacé click para subir el Excel</p>
            <p className="text-xs text-stone-500 mt-0.5">Lee la hoja "Calendario Compras" automáticamente</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
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
        <span className="text-sm text-stone-500">Leyendo calendario…</span>
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
        <span className="text-sm text-stone-500">Guardando {items.length} eventos…</span>
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
          <p className="font-semibold text-stone-800">{items.length} eventos importados al calendario</p>
          <p className="text-xs text-stone-400 mt-1">Aparecen como eventos de compra en las fechas calculadas</p>
        </div>
        <button type="button" className="proj-btn-ghost-sm" onClick={reset}>Importar otro archivo</button>
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
        {errors.map((e, i) => (
          <p key={i} className="text-sm text-red-600 text-center max-w-sm">{e}</p>
        ))}
        <button type="button" className="proj-btn-ghost-sm" onClick={reset}>Intentar de nuevo</button>
      </div>
    )
  }

  // ─── Preview ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
          <span className="text-lg font-bold text-blue-700">{items.length}</span>
          <span className="text-xs text-blue-600">compras a importar</span>
        </div>
        {!projectStartDate && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Sin fecha de inicio del proyecto — se usó la fecha de hoy como semana 1
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">{e}</p>
          ))}
        </div>
      )}

      <div className="overflow-x-auto border border-stone-100 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Material</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500 hidden sm:table-cell">Etapa</th>
              <th className="text-center px-3 py-2 font-medium text-stone-500">Sem.</th>
              <th className="text-center px-3 py-2 font-medium text-stone-500">Fecha compra</th>
              <th className="text-right px-3 py-2 font-medium text-stone-500 hidden md:table-cell">Total ($)</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500 hidden md:table-cell">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 10).map((item, i) => (
              <tr key={i} className="border-t border-stone-50 hover:bg-stone-50">
                <td className="px-3 py-1.5 font-medium text-stone-800 max-w-[200px] truncate">{item.material}</td>
                <td className="px-3 py-1.5 text-stone-500 hidden sm:table-cell">{item.etapa || "—"}</td>
                <td className="px-3 py-1.5 text-center text-stone-500">{item.buyWeek || "—"}</td>
                <td className="px-3 py-1.5 text-center tabular-nums">{fmtDate(item.buyDate)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums hidden md:table-cell">
                  {item.totalCost > 0 ? fmt(item.totalCost) : "—"}
                </td>
                <td className="px-3 py-1.5 hidden md:table-cell">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.statusRaw.includes("✅") || item.statusRaw.toLowerCase().includes("comprado") ? "badge-done" :
                    item.statusRaw.includes("🔄") || item.statusRaw.toLowerCase().includes("proceso") ? "badge-progress" :
                    "badge-pending"
                  }`}>
                    {item.statusRaw || "Pendiente"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 10 && (
          <p className="text-xs text-stone-400 text-center py-2">
            … y {items.length - 10} eventos más
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" className="proj-btn-primary" onClick={handleImport}>
          Importar {items.length} eventos al calendario
        </button>
        <button type="button" className="proj-btn-ghost-sm" onClick={reset}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
