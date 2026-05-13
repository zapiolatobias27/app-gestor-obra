"use client"

import React, { useEffect, useState } from "react"
import { EtapasEditor } from "./etapas-editor"
import { StockEditor } from "./stock-editor"
import { LogisticaEditor } from "./logistica-editor"
import { getStages, getSupplies, getPurchases } from "@/lib/mock-db"

type StepKey = "etapas" | "stock" | "logistica"

const STEPS: { key: StepKey; label: string; desc: string }[] = [
  { key: "etapas",    label: "Etapas",  desc: "Fases del proyecto" },
  { key: "stock",     label: "Insumos", desc: "Materiales necesarios" },
  { key: "logistica", label: "Compras", desc: "Entregas planificadas" },
]

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n)
}

interface Counts { stages: number; supplies: number; purchases: number; budget: number }

export function AdminPanel() {
  const [step, setStep] = useState(0)
  const [counts, setCounts] = useState<Counts>({ stages: 0, supplies: 0, purchases: 0, budget: 0 })

  const reloadCounts = async (): Promise<void> => {
    const [stages, supplies, purchases] = await Promise.all([getStages(), getSupplies(), getPurchases()])
    setCounts({
      stages:    stages.length,
      supplies:  supplies.length,
      purchases: purchases.length,
      budget:    stages.reduce((sum, s) => sum + (s.estimatedCost ?? 0), 0),
    })
  }

  useEffect(() => { reloadCounts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasData: Record<StepKey, boolean> = {
    etapas:    counts.stages > 0,
    stock:     counts.supplies > 0,
    logistica: counts.purchases > 0,
  }

  const current = STEPS[step]

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">

      {/* Stepper */}
      <div className="px-6 pt-5 pb-4 border-b border-stone-200 bg-stone-50">
        <ol className="flex items-start">
          {STEPS.map((s, i) => {
            const active = i === step
            const done   = hasData[s.key] && !active

            return (
              <React.Fragment key={s.key}>
                <li
                  className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  onClick={() => setStep(i)}
                  style={{ minWidth: 64 }}
                >
                  <div className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0",
                    active ? "bg-clay-500 text-white shadow-sm"
                    : done  ? "bg-clay-100 text-clay-700"
                    : "bg-stone-200 text-stone-400 group-hover:bg-stone-300",
                  ].join(" ")}>
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (i + 1)}
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className={`text-xs font-semibold leading-tight ${active ? "text-clay-700" : done ? "text-clay-600" : "text-stone-400"}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-stone-400 leading-tight">{s.desc}</p>
                  </div>
                </li>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px bg-stone-200 mt-4 mx-2" />
                )}
              </React.Fragment>
            )
          })}
        </ol>
      </div>

      {/* Barra de impacto */}
      <div className="px-5 py-2 bg-stone-50 border-b border-stone-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        <span><strong className="text-stone-700">{counts.stages}</strong> etapas</span>
        <span><strong className="text-stone-700">{counts.supplies}</strong> insumos</span>
        <span><strong className="text-stone-700">{counts.purchases}</strong> compras programadas</span>
        {counts.budget > 0 && (
          <span>Presupuesto est.: <strong className="text-stone-700">{fmt(counts.budget)}</strong></span>
        )}
      </div>

      {/* Contenido del paso actual */}
      <div className="p-5">
        {current.key === "etapas"    && <EtapasEditor    onSaved={reloadCounts} />}
        {current.key === "stock"     && <StockEditor     onSaved={reloadCounts} />}
        {current.key === "logistica" && <LogisticaEditor onSaved={reloadCounts} />}
      </div>

      {/* Navegación */}
      <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between bg-stone-50">
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Anterior
        </button>
        <span className="text-xs text-stone-400">Paso {step + 1} de {STEPS.length}</span>
        <button
          type="button"
          onClick={() => setStep(s => s + 1)}
          disabled={step === STEPS.length - 1}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-clay-600 hover:text-clay-800 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          Siguiente
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

    </div>
  )
}
