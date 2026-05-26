"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  getBudgetMovements,
  addBudgetMovement,
  updateProjectBudget,
  getProject,
  getCajaChicaConfig,
  setCajaChicaConfig,
  getCajaChicaExpenses,
  addCajaChicaExpense,
} from "@/lib/mock-db"
import type { BudgetMovement, CajaChicaExpense, MemberPermissions } from "@/types/project"
import { loadPermissionsCache, canView, canEdit } from "@/lib/permissions"

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Materiales", "Mano de obra", "Equipos", "Servicios", "Otros"] as const
type Category = (typeof CATEGORIES)[number]

const CAT_COLORS: Record<Category, string> = {
  "Materiales":    "#3b82f6",
  "Mano de obra":  "#f59e0b",
  "Equipos":       "#8b5cf6",
  "Servicios":     "#10b981",
  "Otros":         "#6b7280",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string): string {
  const d = new Date(iso.slice(0, 10))
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1
  const start = new Date(now)
  start.setDate(now.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function weekLabel(): string {
  const { start, end } = getWeekBounds()
  const s = new Date(start).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
  const e = new Date(end).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
  return `${s} – ${e}`
}

// ─── Pie chart ────────────────────────────────────────────────────────────────

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

interface PieSlice { label: string; value: number; color: string }

function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return (
    <div className="w-36 h-36 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
      <span className="text-xs text-stone-400">Sin gastos</span>
    </div>
  )
  let angle = -Math.PI / 2
  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const delta = (s.value / total) * 2 * Math.PI
      const path = describeArc(72, 72, 68, angle, angle + delta)
      angle += delta
      return { path, color: s.color, label: s.label }
    })
  return (
    <svg width="144" height="144" viewBox="0 0 144 144" aria-hidden="true" className="shrink-0">
      {paths.map((p, i) => <path key={i} d={p.path} fill={p.color} opacity=".9" />)}
      <circle cx="72" cy="72" r="32" fill="white" />
    </svg>
  )
}

// ─── Caja Grande detail ───────────────────────────────────────────────────────

function CajaGrandeDetail({ onBack, perms }: { onBack: () => void; perms: MemberPermissions | null }) {
  const [movements, setMovements] = useState<BudgetMovement[]>([])
  const [budget, setBudget]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [editBudget, setEditBudget] = useState(false)
  const [newBudget, setNewBudget]   = useState("")
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({ description: "", amount: "", category: "Materiales" as Category, date: todayIso() })

  const load = useCallback(async () => {
    setLoading(true)
    const [movs, project] = await Promise.all([getBudgetMovements(), getProject()])
    setMovements(movs)
    setBudget(project?.budgetEstimated ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalGastado = movements.reduce((s, m) => s + Math.abs(Math.min(0, m.amount)), 0)
  const disponible   = Math.max(0, budget - totalGastado)
  const pct          = budget > 0 ? Math.round((totalGastado / budget) * 100) : 0

  const slices: PieSlice[] = CATEGORIES.map((cat) => ({
    label: cat,
    value: movements
      .filter((m) => m.amount < 0 && (m.category ?? "Otros") === cat)
      .reduce((s, m) => s + Math.abs(m.amount), 0),
    color: CAT_COLORS[cat],
  }))

  const handleSaveBudget = async () => {
    const val = parseFloat(newBudget.replace(/\./g, "").replace(",", "."))
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    await updateProjectBudget(val)
    setBudget(val)
    setEditBudget(false)
    setSaving(false)
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(form.amount.replace(/\./g, "").replace(",", "."))
    if (!form.description || isNaN(amt) || amt <= 0) return
    setSaving(true)
    await addBudgetMovement({ description: form.description, amount: -amt, date: form.date, category: form.category })
    setForm({ description: "", amount: "", category: "Materiales", date: todayIso() })
    setShowForm(false)
    await load()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-900">Caja Grande</h2>
          <p className="text-xs text-stone-400">Presupuesto total del proyecto</p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-stone-400">Cargando…</div>
      ) : (
        <>
          {/* Budget header card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Presupuesto total</p>
                {editBudget ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-stone-400 font-medium">$</span>
                    <input type="text" value={newBudget} onChange={(e) => setNewBudget(e.target.value)}
                      placeholder="12.500.000" className="proj-input w-44 text-lg font-bold" autoFocus />
                    <button type="button" onClick={handleSaveBudget} disabled={saving} className="proj-btn-primary text-sm px-3 py-1">
                      {saving ? "…" : "Guardar"}
                    </button>
                    <button type="button" onClick={() => setEditBudget(false)} className="proj-btn-ghost-sm">Cancelar</button>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-stone-900 mt-0.5">{fmt(budget)}</p>
                )}
              </div>
              {!editBudget && canEdit(perms, "caja.grande") && (
                <button type="button" onClick={() => { setNewBudget(budget.toString()); setEditBudget(true) }} className="proj-btn-ghost-sm shrink-0">
                  Editar
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-500 font-medium">Gastado</p>
                <p className="text-lg font-bold text-red-700">{fmt(totalGastado)}</p>
              </div>
              <div className="bg-green-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-green-600 font-medium">Disponible</p>
                <p className="text-lg font-bold text-green-700">{fmt(disponible)}</p>
              </div>
              <div className="bg-stone-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-stone-500 font-medium">Utilizado</p>
                <p className="text-lg font-bold text-stone-700">{pct}%</p>
              </div>
            </div>

            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(100, pct)}%`,
                backgroundColor: pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#10b981",
              }} />
            </div>

            <button type="button" onClick={() => setShowStats((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              {showStats ? "Ocultar estadísticas" : "Ver estadísticas"}
              <svg className={`w-3 h-3 transition-transform ${showStats ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showStats && (
              <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row gap-6 items-center">
                <PieChart slices={slices} />
                <div className="space-y-2 flex-1">
                  {slices.filter((s) => s.value > 0).map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-sm text-stone-600 flex-1">{s.label}</span>
                      <span className="text-sm font-medium text-stone-800">{fmt(s.value)}</span>
                      <span className="text-xs text-stone-400 w-10 text-right">
                        {totalGastado > 0 ? Math.round((s.value / totalGastado) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                  {slices.every((s) => s.value === 0) && (
                    <p className="text-sm text-stone-400">Sin gastos categorizados todavía.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Historial de gastos</h3>
              {canEdit(perms, "caja.grande") && (
                <button type="button" onClick={() => setShowForm((v) => !v)} className="proj-btn-primary text-xs px-3 py-1.5">
                  {showForm ? "Cancelar" : "+ Registrar gasto"}
                </button>
              )}
            </div>

            {showForm && (
              <form onSubmit={handleAddExpense} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Descripción</label>
                    <input type="text" required value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Cemento Portland 50 bolsas…" className="proj-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Monto ($)</label>
                    <input type="text" required value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="45.000" className="proj-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Categoría</label>
                    <select value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                      className="proj-input w-full">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Fecha</label>
                    <input type="date" required value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="proj-input w-full" />
                  </div>
                </div>
                <button type="submit" disabled={saving} className="proj-btn-primary text-sm">
                  {saving ? "Guardando…" : "Guardar gasto"}
                </button>
              </form>
            )}

            {movements.length === 0 ? (
              <p className="text-sm text-stone-400 py-4 text-center">No hay movimientos todavía.</p>
            ) : (
              <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100">
                {movements.map((m) => {
                  const cat = m.category ?? (m.purchaseRequestId ? "Materiales" : "Otros")
                  const color = CAT_COLORS[cat as Category] ?? "#6b7280"
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{m.description}</p>
                        <p className="text-xs text-stone-400">{fmtDate(m.date)} · {cat}</p>
                      </div>
                      <p className={`text-sm font-semibold shrink-0 ${m.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                        {m.amount < 0 ? "-" : "+"}{fmt(Math.abs(m.amount))}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Caja Chica detail ────────────────────────────────────────────────────────

function CajaChicaDetail({ onBack, perms }: { onBack: () => void; perms: MemberPermissions | null }) {
  type Config = { period: "daily" | "weekly" | "monthly"; budget: number }

  const [config, setConfig]         = useState<Config | null>(null)
  const [expenses, setExpenses]     = useState<CajaChicaExpense[]>([])
  const [cfgForm, setCfgForm]       = useState({ period: "daily" as "daily" | "weekly" | "monthly", budget: "" })
  const [showExpForm, setShowExpForm] = useState(false)
  const [expForm, setExpForm]       = useState({ description: "", amount: "", category: "", date: todayIso() })
  const [editingCfg, setEditingCfg] = useState(false)

  useEffect(() => {
    const cfg = getCajaChicaConfig()
    setConfig(cfg)
    if (cfg) setCfgForm({ period: cfg.period, budget: cfg.budget.toString() })
    setExpenses(getCajaChicaExpenses())
  }, [])

  const saveCfg = () => {
    const val = parseFloat(cfgForm.budget.replace(/\./g, "").replace(",", "."))
    if (isNaN(val) || val <= 0) return
    const cfg: Config = { period: cfgForm.period, budget: val }
    setCajaChicaConfig(cfg)
    setConfig(cfg)
    setEditingCfg(false)
  }

  const periodExpenses = expenses.filter((e) => {
    if (!config) return false
    if (config.period === "daily") return e.date === todayIso()
    if (config.period === "weekly") {
      const { start, end } = getWeekBounds()
      return e.date >= start && e.date <= end
    }
    // monthly
    const now = todayIso().slice(0, 7) // "YYYY-MM"
    return e.date.startsWith(now)
  })

  const gastado    = periodExpenses.reduce((s, e) => s + e.amount, 0)
  const disponible = config ? Math.max(0, config.budget - gastado) : 0

  const handleAddExpense = (ev: React.FormEvent) => {
    ev.preventDefault()
    const amt = parseFloat(expForm.amount.replace(/\./g, "").replace(",", "."))
    if (!expForm.description || isNaN(amt) || amt <= 0) return
    const expense = addCajaChicaExpense({
      description: expForm.description, amount: amt,
      date: expForm.date, category: expForm.category || undefined,
    })
    setExpenses((prev) => [...prev, expense])
    setExpForm({ description: "", amount: "", category: "", date: todayIso() })
    setShowExpForm(false)
  }

  const cfgForm_ = (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
      <p className="text-sm font-semibold text-stone-700">
        {editingCfg ? "Editar configuración" : "Configurar Caja Chica"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Período</label>
          <select value={cfgForm.period}
            onChange={(e) => setCfgForm((f) => ({ ...f, period: e.target.value as "daily" | "weekly" | "monthly" }))}
            className="proj-input w-full">
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Presupuesto {cfgForm.period === "daily" ? "por día" : cfgForm.period === "weekly" ? "por semana" : "por mes"} ($)
          </label>
          <input type="text" value={cfgForm.budget}
            onChange={(e) => setCfgForm((f) => ({ ...f, budget: e.target.value }))}
            placeholder="5.000" className="proj-input w-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={saveCfg} className="proj-btn-primary text-sm">Guardar</button>
        {editingCfg && (
          <button type="button" onClick={() => setEditingCfg(false)} className="proj-btn-ghost-sm">Cancelar</button>
        )}
      </div>
    </div>
  )

  const periodLabel = config
    ? config.period === "daily"
      ? `Hoy · ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`
      : config.period === "weekly"
      ? `Semana · ${weekLabel()}`
      : `Mes · ${new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}`
    : ""

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-900">Caja Chica</h2>
          <p className="text-xs text-stone-400">Gastos {config?.period === "weekly" ? "semanales" : config?.period === "monthly" ? "mensuales" : "diarios"}</p>
        </div>
      </div>

      {(!config || editingCfg) && canEdit(perms, "caja.chica") ? cfgForm_ : (!config || editingCfg) ? (
        <p className="text-sm text-stone-400 py-6 text-center">Sin permiso para configurar Caja Chica.</p>
      ) : (
        <>
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
                  {config.period === "daily" ? "Caja diaria" : config.period === "weekly" ? "Caja semanal" : "Caja mensual"}
                </p>
                <p className="text-lg font-bold text-stone-800 mt-0.5">{periodLabel}</p>
              </div>
              {canEdit(perms, "caja.chica") && (
                <button type="button" onClick={() => { setCfgForm({ period: config.period, budget: config.budget.toString() }); setEditingCfg(true) }} className="proj-btn-ghost-sm">
                  Configurar
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-stone-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-stone-500 font-medium">Presupuesto</p>
                <p className="text-lg font-bold text-stone-700">{fmt(config.budget)}</p>
              </div>
              <div className="bg-red-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-500 font-medium">Gastado</p>
                <p className="text-lg font-bold text-red-700">{fmt(gastado)}</p>
              </div>
              <div className="bg-green-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-green-600 font-medium">Disponible</p>
                <p className="text-lg font-bold text-green-700">{fmt(disponible)}</p>
              </div>
            </div>

            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(100, config.budget > 0 ? Math.round((gastado / config.budget) * 100) : 0)}%`,
                backgroundColor: gastado / config.budget > 0.9 ? "#ef4444" : gastado / config.budget > 0.7 ? "#f59e0b" : "#10b981",
              }} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Gastos del período</h3>
              {canEdit(perms, "caja.chica") && (
                <button type="button" onClick={() => setShowExpForm((v) => !v)} className="proj-btn-primary text-xs px-3 py-1.5">
                  {showExpForm ? "Cancelar" : "+ Agregar gasto"}
                </button>
              )}
            </div>

            {showExpForm && (
              <form onSubmit={handleAddExpense} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Descripción</label>
                    <input type="text" required value={expForm.description}
                      onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Almuerzo del equipo…" className="proj-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Monto ($)</label>
                    <input type="text" required value={expForm.amount}
                      onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="1.200" className="proj-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Categoría (opcional)</label>
                    <input type="text" value={expForm.category}
                      onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="Comidas, herramientas…" className="proj-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Fecha</label>
                    <input type="date" required value={expForm.date}
                      onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))}
                      className="proj-input w-full" />
                  </div>
                </div>
                <button type="submit" className="proj-btn-primary text-sm">Guardar</button>
              </form>
            )}

            {periodExpenses.length === 0 ? (
              <p className="text-sm text-stone-400 py-4 text-center">Sin gastos en este período.</p>
            ) : (
              <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100">
                {[...periodExpenses].reverse().map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{e.description}</p>
                      <p className="text-xs text-stone-400">{fmtDate(e.date)}{e.category ? ` · ${e.category}` : ""}</p>
                    </div>
                    <p className="text-sm font-semibold text-red-600 shrink-0">-{fmt(e.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Overview cards ───────────────────────────────────────────────────────────

function CajaOverview({ onEnter, perms }: { onEnter: (caja: "grande" | "chica") => void; perms: MemberPermissions | null }) {
  const [budgetEstimated, setBudgetEstimated] = useState(0)
  const [totalGastado, setTotalGastado]       = useState(0)
  const [cajaChicaConfig, setCajaChicaConfigState] = useState<{ period: "daily" | "weekly" | "monthly"; budget: number } | null>(null)
  const [cajaChicaGastado, setCajaChicaGastado]    = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [movs, project] = await Promise.all([getBudgetMovements(), getProject()])
      setBudgetEstimated(project?.budgetEstimated ?? 0)
      setTotalGastado(movs.reduce((s, m) => s + Math.abs(Math.min(0, m.amount)), 0))

      const cfg = getCajaChicaConfig()
      setCajaChicaConfigState(cfg)
      if (cfg) {
        const exps = getCajaChicaExpenses()
        const today = todayIso()
        const { start, end } = getWeekBounds()
        const currentMonth = today.slice(0, 7)
        const periodExps = exps.filter((e) =>
          cfg.period === "daily" ? e.date === today
          : cfg.period === "weekly" ? e.date >= start && e.date <= end
          : e.date.startsWith(currentMonth),
        )
        setCajaChicaGastado(periodExps.reduce((s, e) => s + e.amount, 0))
      }
      setLoading(false)
    }
    load()
  }, [])

  const disponibleGrande = Math.max(0, budgetEstimated - totalGastado)
  const pctGrande        = budgetEstimated > 0 ? Math.round((totalGastado / budgetEstimated) * 100) : 0
  const disponibleChica  = cajaChicaConfig ? Math.max(0, cajaChicaConfig.budget - cajaChicaGastado) : 0
  const pctChica         = cajaChicaConfig && cajaChicaConfig.budget > 0
    ? Math.round((cajaChicaGastado / cajaChicaConfig.budget) * 100) : 0

  if (loading) return <div className="py-12 text-center text-sm text-stone-400">Cargando…</div>

  return (
    <div className="space-y-4">
      {/* Caja Grande card */}
      {canView(perms, "caja.grande") && <button
        type="button"
        onClick={() => onEnter("grande")}
        className="w-full text-left bg-white border border-stone-200 rounded-2xl p-6 hover:border-stone-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Caja Grande</p>
            <p className="text-3xl font-bold text-stone-900">{fmt(budgetEstimated)}</p>
            <p className="text-sm text-stone-500">Presupuesto total del proyecto</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center transition-colors shrink-0 mt-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-stone-400">Gastado</p>
            <p className="text-base font-bold text-red-600">{fmt(totalGastado)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400">Disponible</p>
            <p className="text-base font-bold text-green-600">{fmt(disponibleGrande)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400">Utilizado</p>
            <p className="text-base font-bold text-stone-700">{pctGrande}%</p>
          </div>
        </div>

        <div className="mt-4 w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{
            width: `${Math.min(100, pctGrande)}%`,
            backgroundColor: pctGrande > 90 ? "#ef4444" : pctGrande > 70 ? "#f59e0b" : "#10b981",
          }} />
        </div>
      </button>}

      {/* Caja Chica card */}
      {canView(perms, "caja.chica") && <button
        type="button"
        onClick={() => onEnter("chica")}
        className="w-full text-left bg-white border border-stone-200 rounded-2xl p-6 hover:border-stone-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Caja Chica</p>
            {cajaChicaConfig ? (
              <>
                <p className="text-3xl font-bold text-stone-900">{fmt(cajaChicaConfig.budget)}</p>
                <p className="text-sm text-stone-500">
                  Presupuesto {cajaChicaConfig.period === "daily" ? "diario" : cajaChicaConfig.period === "weekly" ? "semanal" : "mensual"}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-stone-400">—</p>
                <p className="text-sm text-stone-400">Sin configurar todavía</p>
              </>
            )}
          </div>
          <div className="w-9 h-9 rounded-full bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center transition-colors shrink-0 mt-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {cajaChicaConfig && (
          <>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-stone-400">Gastado hoy</p>
                <p className="text-base font-bold text-red-600">{fmt(cajaChicaGastado)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Disponible</p>
                <p className="text-base font-bold text-green-600">{fmt(disponibleChica)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Utilizado</p>
                <p className="text-base font-bold text-stone-700">{pctChica}%</p>
              </div>
            </div>

            <div className="mt-4 w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${Math.min(100, pctChica)}%`,
                backgroundColor: pctChica > 90 ? "#ef4444" : pctChica > 70 ? "#f59e0b" : "#10b981",
              }} />
            </div>
          </>
        )}
      </button>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = "overview" | "grande" | "chica"

export default function CajaPage() {
  const [view, setView] = useState<View>("overview")
  const perms = loadPermissionsCache()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {view === "overview" && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Caja</h1>
            <p className="text-sm text-stone-400 mt-0.5">Control de presupuesto y gastos del proyecto</p>
          </div>
          <CajaOverview onEnter={setView} perms={perms} />
        </>
      )}

      {view === "grande" && <CajaGrandeDetail onBack={() => setView("overview")} perms={perms} />}
      {view === "chica"  && <CajaChicaDetail  onBack={() => setView("overview")} perms={perms} />}
    </div>
  )
}
