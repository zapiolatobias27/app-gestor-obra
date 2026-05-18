"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  getInvoices,
  addInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  getPurchases,
} from "@/lib/mock-db"
import { getActiveProjectId } from "@/lib/projects-db"
import { createClient } from "@/lib/supabase/client"
import type { Invoice, PurchaseScheduleItem } from "@/types/project"

const todayStr = new Date().toISOString().split("T")[0]

type EnrichedInvoice = Invoice & { _status: Invoice["status"] }

function effectiveStatus(inv: Invoice): Invoice["status"] {
  if (inv.status === "pending" && inv.dueDate && inv.dueDate < todayStr) return "overdue"
  return inv.status
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(d?: string) {
  if (!d) return "—"
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y}`
}

const STATUS_LABEL: Record<Invoice["status"], string> = {
  pending: "Pendiente",
  paid: "Pagada",
  overdue: "Vencida",
}

const STATUS_BADGE: Record<Invoice["status"], string> = {
  pending: "badge-pending",
  paid: "badge-done",
  overdue: "badge-blocked",
}

const PURCHASE_STATUS_BADGE: Record<PurchaseScheduleItem["status"], string> = {
  pending: "badge-pending",
  ordered: "badge-progress",
  delivered: "badge-done",
  critical: "badge-blocked",
}

const PURCHASE_STATUS_LABEL: Record<PurchaseScheduleItem["status"], string> = {
  pending: "Pendiente",
  ordered: "Pedido",
  delivered: "Entregado",
  critical: "Crítico",
}

interface FormState {
  supplier: string
  description: string
  amount: string
  date: string
  dueDate: string
  invoiceNumber: string
  notes: string
  photoFile: File | null
  photoPreview: string | null
}

const EMPTY_FORM: FormState = {
  supplier: "",
  description: "",
  amount: "",
  date: todayStr,
  dueDate: "",
  invoiceNumber: "",
  notes: "",
  photoFile: null,
  photoPreview: null,
}

// ─── AFIP PDF extractor ───────────────────────────────────────────────────────

function parseArgDate(s: string): string {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ""
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseAfipLines(lines: string[]): Partial<FormState> {
  const result: Partial<FormState> = {}

  // Proveedor: name right after ORIGINAL / DUPLICADO / TRIPLICADO
  const copyTypeIdx = lines.findIndex((l) => ["ORIGINAL", "DUPLICADO", "TRIPLICADO"].includes(l))
  if (copyTypeIdx !== -1 && lines[copyTypeIdx + 1]) {
    result.supplier = lines[copyTypeIdx + 1]
  }

  // N° de factura: "Punto de Venta: 00001 Comp. Nro: 00000013"
  const pvLine = lines.find((l) => l.includes("Punto de Venta:") && l.includes("Comp. Nro:"))
  if (pvLine) {
    const pv  = pvLine.match(/Punto de Venta:\s*(\d+)/)
    const nro = pvLine.match(/Comp\. Nro:\s*(\d+)/)
    if (pv && nro) result.invoiceNumber = `${pv[1].replace(/^0+/, "") || pv[1]}-${nro[1]}`
  }

  // Dates: line with exactly 3 dates "DD/MM/YYYY DD/MM/YYYY DD/MM/YYYY"
  const threeDatesLine = lines.find((l) => {
    const m = l.match(/\d{2}\/\d{2}\/\d{4}/g)
    return m && m.length === 3
  })
  if (threeDatesLine) {
    const dates = threeDatesLine.match(/\d{2}\/\d{2}\/\d{4}/g)!
    result.dueDate = parseArgDate(dates[2]) // tercera = Fecha Vto pago
    // Fecha emisión: standalone date on next line
    const idx = lines.indexOf(threeDatesLine)
    const next = lines[idx + 1]
    if (next && /^\d{2}\/\d{2}\/\d{4}$/.test(next)) result.date = parseArgDate(next)
  }

  // Concepto: first line with "unidades"
  const itemLine = lines.find((l) => /unidades/i.test(l) && /\d+,\d{2}/.test(l))
  if (itemLine) {
    const m = itemLine.match(/^(.+?)\s+\d+[.,]\d{2}\s+unidades/i)
    if (m) result.description = m[1].trim()
  }

  // Importe Total: last standalone number before "CAE N°"
  const caeIdx = lines.findIndex((l) => l.includes("CAE N°"))
  if (caeIdx > 0) {
    for (let i = caeIdx - 1; i >= 0; i--) {
      const clean = lines[i].replace(/[\s$]/g, "")
      if (/^\d+[.,]\d{2}$/.test(clean)) {
        result.amount = clean.replace(/\./g, "").replace(",", ".")
        break
      }
    }
  }

  return result
}

async function extractFromPdf(file: File): Promise<Partial<FormState>> {
  try {
    // Dynamic import — avoids SSR, loads pdfjs only when needed
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf" as string) as typeof import("pdfjs-dist")
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"

    const buffer = await file.arrayBuffer()
    const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
    const page   = await pdf.getPage(1)
    const tc     = await page.getTextContent()
    const lines  = (tc.items as Array<{ str: string }>)
      .map((i) => i.str.trim())
      .filter(Boolean)

    return parseAfipLines(lines)
  } catch {
    return {}
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([])
  const [purchases, setPurchases] = useState<PurchaseScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting]   = useState(false)
  const [extracting, setExtracting]   = useState(false)
  const [autoFilled, setAutoFilled]   = useState(false)
  const [formError, setFormError]     = useState("")
  const photoRef = useRef<HTMLInputElement>(null)
  const pdfRef   = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invs, purs] = await Promise.all([getInvoices(), getPurchases()])
      setInvoices(invs.map((inv) => ({ ...inv, _status: effectiveStatus(inv) })))
      setPurchases(purs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalFacturado = invoices.reduce((s, i) => s + i.amount, 0)
  const totalPagado = invoices.filter((i) => i._status === "paid").reduce((s, i) => s + i.amount, 0)
  const totalPendiente = invoices.filter((i) => i._status === "pending").reduce((s, i) => s + i.amount, 0)
  const totalVencidas = invoices.filter((i) => i._status === "overdue").length
  const purchasesTotal = purchases.reduce((s, p) => s + (p.realCost ?? p.estimatedCost), 0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setForm((f) => ({ ...f, photoFile: file, photoPreview: URL.createObjectURL(file) }))
  }

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setForm((f) => ({ ...f, photoFile: file, photoPreview: URL.createObjectURL(file) }))
    setAutoFilled(false)
    setExtracting(true)
    try {
      const extracted = await extractFromPdf(file)
      if (Object.keys(extracted).length > 0) {
        setForm((f) => ({
          ...f,
          supplier:      extracted.supplier      ?? f.supplier,
          description:   extracted.description   ?? f.description,
          amount:        extracted.amount        ?? f.amount,
          date:          extracted.date          ?? f.date,
          dueDate:       extracted.dueDate       ?? f.dueDate,
          invoiceNumber: extracted.invoiceNumber ?? f.invoiceNumber,
        }))
        setAutoFilled(true)
      }
    } finally {
      setExtracting(false)
    }
  }

  const resetForm = () => {
    if (form.photoPreview) URL.revokeObjectURL(form.photoPreview)
    setForm(EMPTY_FORM)
    setFormError("")
    setAutoFilled(false)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.supplier.trim() || !form.description.trim() || !form.amount || !form.date) {
      setFormError("Completá los campos obligatorios.")
      return
    }
    setSubmitting(true)
    setFormError("")
    try {
      const id = crypto.randomUUID()
      let photoUrl: string | undefined

      if (form.photoFile) {
        const supabase = createClient()
        const pid = getActiveProjectId()
        const ext = form.photoFile.name.split(".").pop() ?? "jpg"
        const path = `${pid}/${id}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(path, form.photoFile, { contentType: form.photoFile.type })
        if (uploadError) throw new Error(uploadError.message)
        const { data: { publicUrl } } = supabase.storage.from("invoices").getPublicUrl(path)
        photoUrl = publicUrl
      }

      await addInvoice({
        id,
        projectId: getActiveProjectId(),
        supplier: form.supplier.trim(),
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        date: form.date,
        dueDate: form.dueDate || undefined,
        status: "pending",
        invoiceNumber: form.invoiceNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
        photoUrl,
      })

      resetForm()
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar la factura")
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkPaid = async (id: string) => {
    await updateInvoiceStatus(id, "paid")
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta factura?")) return
    await deleteInvoice(id)
    await load()
  }

  return (
    <div className="page-wrap space-y-6">
      <div>
        <p className="page-eyebrow">Gestión económica</p>
        <h1 className="page-title">Facturas y Compras</h1>
        <p className="page-subtitle">Seguimiento de gastos, compras planificadas y facturas registradas.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Total facturado</p>
          <p className="stat-card-value">{fmt(totalFacturado)}</p>
        </div>
        <div className="stat-card stat-card-accent-green">
          <p className="stat-card-label">Pagado</p>
          <p className="stat-card-value">{fmt(totalPagado)}</p>
        </div>
        <div className="stat-card stat-card-accent-orange">
          <p className="stat-card-label">Pendiente</p>
          <p className="stat-card-value">{fmt(totalPendiente)}</p>
        </div>
        <div className="stat-card stat-card-accent-red">
          <p className="stat-card-label">Vencidas</p>
          <p className="stat-card-value">{totalVencidas}</p>
          <p className="stat-card-sub">{totalVencidas === 1 ? "factura" : "facturas"}</p>
        </div>
      </div>

      {/* Compras de Logística */}
      <div className="card-obra p-5">
        <div className="mb-4">
          <h2 className="section-title">Compras de Logística</h2>
          <p className="page-subtitle">
            Compras planificadas · Total: {fmt(purchasesTotal)}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Cargando…</p>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-stone-400">No hay compras planificadas aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-stone-100">
                  <th className="pb-2 pr-4 font-medium text-stone-500">Material</th>
                  <th className="pb-2 pr-4 font-medium text-stone-500">Unidad</th>
                  <th className="pb-2 pr-4 font-medium text-stone-500 text-right">Cant.</th>
                  <th className="pb-2 pr-4 font-medium text-stone-500 text-right">Sem.</th>
                  <th className="pb-2 pr-4 font-medium text-stone-500 text-right">Costo est.</th>
                  <th className="pb-2 pr-4 font-medium text-stone-500 text-right">Costo real</th>
                  <th className="pb-2 font-medium text-stone-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="py-2 pr-4 font-medium text-stone-800">{p.material}</td>
                    <td className="py-2 pr-4 text-stone-500">{p.unit}</td>
                    <td className="py-2 pr-4 text-stone-600 text-right tabular-nums">{p.quantity}</td>
                    <td className="py-2 pr-4 text-stone-500 text-right tabular-nums">{p.deliveryWeek}</td>
                    <td className="py-2 pr-4 text-stone-600 text-right tabular-nums">{fmt(p.estimatedCost)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {p.realCost != null ? (
                        <span className="text-stone-800 font-medium">{fmt(p.realCost)}</span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PURCHASE_STATUS_BADGE[p.status]}`}>
                        {PURCHASE_STATUS_LABEL[p.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Facturas registradas */}
      <div className="card-obra p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Facturas registradas</h2>
          {!showForm && (
            <button
              type="button"
              className="proj-btn-primary"
              onClick={() => setShowForm(true)}
            >
              + Nueva factura
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 bg-stone-50 rounded-xl p-4 space-y-4 border border-stone-100"
          >
            <h3 className="font-semibold text-stone-800">Nueva factura</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Proveedor *
                </label>
                <input
                  type="text"
                  className="proj-form-input w-full"
                  value={form.supplier}
                  onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                  placeholder="Ej: Hormicenter SA"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Concepto *
                </label>
                <input
                  type="text"
                  className="proj-form-input w-full"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Cemento Portland 50 bolsas"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Monto (ARS) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="proj-form-input w-full"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  className="proj-form-input w-full"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Fecha de vencimiento
                </label>
                <input
                  type="date"
                  className="proj-form-input w-full"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  N° de factura
                </label>
                <input
                  type="text"
                  className="proj-form-input w-full"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  placeholder="Ej: A-0001-00001234"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Notas</label>
              <textarea
                className="proj-form-input w-full resize-none"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observaciones opcionales…"
              />
            </div>

            {/* Comprobante (imagen o PDF) */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-2">
                Comprobante
              </label>
              {form.photoFile ? (
                <div className="flex items-start gap-3">
                  {form.photoFile.type.startsWith("image/") ? (
                    <a href={form.photoPreview!} target="_blank" rel="noreferrer">
                      <img
                        src={form.photoPreview!}
                        alt="Vista previa"
                        className="w-24 h-24 object-cover rounded-lg border border-stone-200 cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <rect x="3" y="1" width="11" height="15" rx="1.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
                        <path d="M11 1v4h4" stroke="#94a3b8" strokeWidth="1" fill="none" />
                        <text x="5" y="13" fontSize="5" fontWeight="bold" fill="#dc2626" fontFamily="sans-serif">PDF</text>
                      </svg>
                      <span className="text-xs text-stone-600 truncate max-w-[140px]">{form.photoFile.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="proj-btn-ghost-sm"
                    onClick={() => {
                      if (form.photoPreview) URL.revokeObjectURL(form.photoPreview)
                      setForm((f) => ({ ...f, photoFile: null, photoPreview: null }))
                      if (photoRef.current) photoRef.current.value = ""
                      if (pdfRef.current)   pdfRef.current.value   = ""
                    }}
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="proj-btn-ghost-sm"
                    onClick={() => photoRef.current?.click()}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="inline mr-1">
                      <rect x="1" y="2" width="12" height="10" rx="1" fill="currentColor" opacity=".4" />
                      <circle cx="4.5" cy="5.5" r="1" fill="currentColor" opacity=".8" />
                      <path d="M1 9L4 7L6 8.5L9 6.5L13 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    Foto
                  </button>
                  <button
                    type="button"
                    className="proj-btn-ghost-sm"
                    onClick={() => pdfRef.current?.click()}
                  >
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="inline mr-1">
                      <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".3" stroke="currentColor" strokeWidth="1" />
                      <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1" fill="none" opacity=".6" />
                      <text x="5" y="13" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">PDF</text>
                    </svg>
                    PDF
                  </button>
                </div>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="proj-btn-primary"
                disabled={submitting}
              >
                {submitting ? "Guardando…" : "Guardar factura"}
              </button>
              <button
                type="button"
                className="proj-btn-ghost"
                onClick={resetForm}
                disabled={submitting}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-stone-400">Cargando…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-stone-400">No hay facturas registradas aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-stone-100">
                  <th className="pb-2 pr-3 font-medium text-stone-500">N°</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500">Proveedor</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500">Concepto</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500 text-right">Monto</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500">Fecha</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500">Vencimiento</th>
                  <th className="pb-2 pr-3 font-medium text-stone-500">Estado</th>
                  <th className="pb-2 font-medium text-stone-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="py-2 pr-3 text-stone-400 text-xs tabular-nums">
                      {inv.invoiceNumber ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-medium text-stone-800 max-w-[120px] truncate">
                      {inv.supplier}
                    </td>
                    <td className="py-2 pr-3 text-stone-600 max-w-[180px] truncate">
                      {inv.description}
                    </td>
                    <td className="py-2 pr-3 text-stone-800 font-medium text-right tabular-nums">
                      {fmt(inv.amount)}
                    </td>
                    <td className="py-2 pr-3 text-stone-500 tabular-nums whitespace-nowrap">
                      {fmtDate(inv.date)}
                    </td>
                    <td className="py-2 pr-3 text-stone-500 tabular-nums whitespace-nowrap">
                      {fmtDate(inv.dueDate)}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[inv._status]}`}
                        >
                          {STATUS_LABEL[inv._status]}
                        </span>
                        {inv.photoUrl && (
                          <a
                            href={inv.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={inv.photoUrl.toLowerCase().endsWith(".pdf") ? "Ver PDF" : "Ver imagen"}
                            className="text-stone-400 hover:text-stone-700 transition-colors"
                          >
                            {inv.photoUrl.toLowerCase().endsWith(".pdf") ? (
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".3" stroke="currentColor" strokeWidth="1" />
                                <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1" fill="none" opacity=".6" />
                                <text x="5" y="13" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">PDF</text>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                <rect x="1" y="2" width="12" height="10" rx="1" fill="currentColor" opacity=".3" />
                                <circle cx="4.5" cy="5.5" r="1" fill="currentColor" opacity=".8" />
                                <path d="M1 9L4 7L6 8.5L9 6.5L13 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </svg>
                            )}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        {inv._status !== "paid" && (
                          <button
                            type="button"
                            className="proj-btn-ghost-sm"
                            onClick={() => handleMarkPaid(inv.id)}
                          >
                            Marcar pagada
                          </button>
                        )}
                        <button
                          type="button"
                          className="proj-btn-danger-sm"
                          onClick={() => handleDelete(inv.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
