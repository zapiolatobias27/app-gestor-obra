"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  getInvoices,
  addInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  getPurchases,
  getRemitos,
  addRemito,
  deleteRemito,
  getSupplies,
} from "@/lib/mock-db"
import { parseNum } from "@/lib/parseNum"
import { getActiveProjectId } from "@/lib/projects-db"
import { createClient } from "@/lib/supabase/client"
import type { Invoice, PurchaseScheduleItem, Remito } from "@/types/project"
import type { SupplyItem } from "@/types/stock"
import { loadPermissionsCache, canView, canEdit } from "@/lib/permissions"

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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
  amount: "",
  date: todayStr,
  dueDate: "",
  invoiceNumber: "",
  notes: "",
  photoFile: null,
  photoPreview: null,
}

interface RemitoFormState {
  supplier: string
  remitoNumber: string
  date: string
  description: string
  notes: string
  photoFile: File | null
  photoPreview: string | null
  supplyItemId: string
  supplyQty: string
}

const EMPTY_REMITO_FORM: RemitoFormState = {
  supplier: "",
  remitoNumber: "",
  date: todayStr,
  description: "",
  notes: "",
  photoFile: null,
  photoPreview: null,
  supplyItemId: "",
  supplyQty: "",
}

// ─── AFIP PDF extractor ───────────────────────────────────────────────────────

function parseArgDate(s: string): string {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ""
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseAmount(raw: string): string | null {
  // Handles: "219307,00" / "219.307,00" / "219307.00"
  const clean = raw.replace(/[\s$]/g, "")
  if (/^\d[\d.]*,\d{2}$/.test(clean)) {
    return clean.replace(/\./g, "").replace(",", ".")
  }
  if (/^\d+\.\d{2}$/.test(clean)) return clean
  return null
}

function parseAfipLines(lines: string[]): Partial<FormState> {
  const result: Partial<FormState> = {}

  // Supplier: name right after ORIGINAL / DUPLICADO / TRIPLICADO
  const copyTypeIdx = lines.findIndex((l) => ["ORIGINAL", "DUPLICADO", "TRIPLICADO"].includes(l))
  if (copyTypeIdx !== -1 && lines[copyTypeIdx + 1]) {
    result.supplier = lines[copyTypeIdx + 1]
  }

  // Invoice number — may be one line or tokens split across consecutive lines
  const pvIdx = lines.findIndex((l) => l.includes("Punto de Venta:"))
  if (pvIdx !== -1) {
    // Join up to 4 tokens from this index to capture split lines
    const chunk = lines.slice(pvIdx, pvIdx + 4).join(" ")
    const pv  = chunk.match(/Punto de Venta:\s*(\d+)/)
    const nro = chunk.match(/Comp\.?\s*Nro:?\s*(\d+)/)
    if (pv && nro) result.invoiceNumber = `${pv[1].replace(/^0+/, "") || pv[1]}-${nro[1]}`
  }

  // Dates: line with exactly 3 dates OR two separate date lines
  const threeDatesLine = lines.find((l) => {
    const m = l.match(/\d{2}\/\d{2}\/\d{4}/g)
    return m && m.length === 3
  })
  if (threeDatesLine) {
    const dates = threeDatesLine.match(/\d{2}\/\d{2}\/\d{4}/g)!
    result.dueDate = parseArgDate(dates[2])
    const idx = lines.indexOf(threeDatesLine)
    const next = lines[idx + 1]
    if (next && /^\d{2}\/\d{2}\/\d{4}$/.test(next)) result.date = parseArgDate(next)
  } else {
    // Fallback: emission date near "Fecha de Emisión"
    const emisIdx = lines.findIndex((l) => l.includes("Fecha de Emisión"))
    if (emisIdx !== -1) {
      for (let i = emisIdx + 1; i < Math.min(emisIdx + 4, lines.length); i++) {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(lines[i])) {
          result.date = parseArgDate(lines[i])
          break
        }
      }
    }
    // Due date: near "Fecha de Vto"
    const vtoIdx = lines.findIndex((l) => l.includes("Fecha de Vto"))
    if (vtoIdx !== -1) {
      for (let i = vtoIdx + 1; i < Math.min(vtoIdx + 4, lines.length); i++) {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(lines[i])) {
          result.dueDate = parseArgDate(lines[i])
          break
        }
      }
    }
  }

  // Amount — primary: look after "Importe Total"
  const totalIdx = lines.findIndex((l) => /importe total/i.test(l))
  if (totalIdx !== -1) {
    for (let i = totalIdx + 1; i < Math.min(totalIdx + 5, lines.length); i++) {
      const parsed = parseAmount(lines[i])
      if (parsed) { result.amount = parsed; break }
    }
    // Also check if the value is in the same line after "$"
    if (!result.amount) {
      const inLine = lines[totalIdx].replace(/^.*\$\s*/, "").trim()
      const parsed = parseAmount(inLine)
      if (parsed) result.amount = parsed
    }
  }
  // Fallback: last standalone number before "CAE N°"
  if (!result.amount) {
    const caeIdx = lines.findIndex((l) => l.includes("CAE N°"))
    if (caeIdx > 0) {
      for (let i = caeIdx - 1; i >= 0; i--) {
        const parsed = parseAmount(lines[i])
        if (parsed) { result.amount = parsed; break }
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

// ─── Remito PDF extractor ─────────────────────────────────────────────────────

function parseRemitoPdfLines(lines: string[]): Partial<RemitoFormState> {
  const result: Partial<RemitoFormState> = {}

  // Supplier: first non-trivial line that's not a document type header
  const skipHeader = /^(remito|recibo|nota de entrega|delivery|r e m i t o)/i
  const firstMeaningful = lines.find((l) => l.trim().length > 3 && !skipHeader.test(l.trim()))
  if (firstMeaningful) result.supplier = firstMeaningful.trim()

  // Remito number: look for "Nro:", "N°:", "Remito N°:" patterns
  for (const line of lines) {
    const m = line.match(/(?:Nro\.?|N[°º]\.?|Remito\s+N[°º]\.?)[\s:]*([A-Z0-9\-\/]+)/i)
    if (m && m[1] && m[1].length >= 3 && m[1].length <= 20) {
      result.remitoNumber = m[1].trim()
      break
    }
  }

  // Date: first DD/MM/YYYY pattern
  for (const line of lines) {
    const m = line.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (m) {
      result.date = `${m[3]}-${m[2]}-${m[1]}`
      break
    }
  }

  // Description: lines that look like material descriptions (contain both digits and letters)
  const skipDesc = /cuit|iva|tel[eé]f|direcc|ciudad|provinci|e-mail|web|http|fecha|firma|sello|total|subtotal|neto|tributo|descuento/i
  const descLines: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.length < 5) continue
    if (skipDesc.test(t)) continue
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) continue
    if (/\d/.test(t) && /[a-záéíóúñ]/i.test(t)) {
      descLines.push(t)
      if (descLines.length >= 3) break
    }
  }
  if (descLines.length > 0) result.description = descLines.join("; ")

  return result
}

async function extractFromRemitoPdf(file: File): Promise<Partial<RemitoFormState>> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf" as string) as typeof import("pdfjs-dist")
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"
    const buffer = await file.arrayBuffer()
    const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
    const page   = await pdf.getPage(1)
    const tc     = await page.getTextContent()
    const lines  = (tc.items as Array<{ str: string }>)
      .map((i) => i.str.trim())
      .filter(Boolean)
    return parseRemitoPdfLines(lines)
  } catch {
    return {}
  }
}

export default function InvoicesPage() {
  const perms = loadPermissionsCache()
  const showFacturas = canView(perms, "invoices.facturas")
  const showRemitos  = canView(perms, "invoices.remitos")
  const canEditFacturas = canEdit(perms, "invoices.facturas")
  const canEditRemitos  = canEdit(perms, "invoices.remitos")

  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([])
  const [purchases, setPurchases] = useState<PurchaseScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting]   = useState(false)
  const [extracting, setExtracting]   = useState(false)
  const [autoFilled, setAutoFilled]   = useState(false)
  const [formError, setFormError]     = useState("")
  const [dragOver, setDragOver]       = useState(false)
  const [pdfPreview, setPdfPreview]   = useState<string | null>(null)
  const [imgPreview, setImgPreview]   = useState<string | null>(null)
  const pdfRef   = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<"facturas" | "remitos">(showFacturas ? "facturas" : "remitos")
  const [remitos, setRemitos]               = useState<Remito[]>([])
  const [supplies, setSupplies]             = useState<SupplyItem[]>([])
  const [showRemitoForm, setShowRemitoForm] = useState(false)
  const [remitoForm, setRemitoForm]         = useState<RemitoFormState>(EMPTY_REMITO_FORM)
  const [remitoSubmitting, setRemitoSubmitting] = useState(false)
  const [remitoError, setRemitoError]       = useState("")
  const [extractingRemito, setExtractingRemito] = useState(false)
  const [autoFilledRemito, setAutoFilledRemito] = useState(false)
  const remitoFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invs, purs, rems, sups] = await Promise.all([getInvoices(), getPurchases(), getRemitos(), getSupplies()])
      setInvoices(invs.map((inv) => ({ ...inv, _status: effectiveStatus(inv) })))
      setPurchases(purs)
      setRemitos(rems)
      setSupplies(sups)
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

  const handlePdfFile = async (file: File) => {
    if (file.type !== "application/pdf") return
    setForm((f) => ({ ...f, photoFile: file, photoPreview: URL.createObjectURL(file) }))
    setAutoFilled(false)
    setExtracting(true)
    try {
      const extracted = await extractFromPdf(file)
      if (Object.keys(extracted).length > 0) {
        setForm((f) => ({
          ...f,
          supplier:      extracted.supplier      ?? f.supplier,
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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handlePdfFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handlePdfFile(file)
  }

  const resetForm = () => {
    if (form.photoPreview) URL.revokeObjectURL(form.photoPreview)
    setForm(EMPTY_FORM)
    setFormError("")
    setAutoFilled(false)
    setDragOver(false)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || !form.date) {
      setFormError("El monto y la fecha son obligatorios.")
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
        supplier: form.supplier.trim() || "—",
        amount: parseNum(form.amount),
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
      setFormError(err instanceof Error ? err.message : "Error al guardar el ticket")
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkPaid = async (id: string) => {
    await updateInvoiceStatus(id, "paid")
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este ticket?")) return
    await deleteInvoice(id)
    await load()
  }

  const resetRemitoForm = () => {
    if (remitoForm.photoPreview) URL.revokeObjectURL(remitoForm.photoPreview)
    setRemitoForm(EMPTY_REMITO_FORM)
    setRemitoError("")
    setAutoFilledRemito(false)
    setShowRemitoForm(false)
  }

  const handleRemitoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const descRequired = !remitoForm.supplyItemId
    if (!remitoForm.supplier.trim() || !remitoForm.date || (descRequired && !remitoForm.description.trim())) {
      setRemitoError(descRequired ? "Proveedor, descripción y fecha son obligatorios." : "Proveedor y fecha son obligatorios.")
      return
    }
    setRemitoSubmitting(true)
    setRemitoError("")
    try {
      let photoUrl: string | undefined

      if (remitoForm.photoFile) {
        const supabase = createClient()
        const pid = getActiveProjectId()
        const ext = remitoForm.photoFile.name.split(".").pop() ?? "pdf"
        const path = `${pid}/${crypto.randomUUID()}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(path, remitoForm.photoFile, { contentType: remitoForm.photoFile.type })
        if (uploadError) throw new Error(uploadError.message)
        const { data: { publicUrl } } = supabase.storage.from("invoices").getPublicUrl(path)
        photoUrl = publicUrl
      }

      const supplyQtyParsed = parseNum(remitoForm.supplyQty)
      await addRemito({
        projectId: getActiveProjectId() ?? "",
        supplier: remitoForm.supplier.trim(),
        remitoNumber: remitoForm.remitoNumber.trim() || undefined,
        date: remitoForm.date,
        description: remitoForm.description.trim(),
        notes: remitoForm.notes.trim() || undefined,
        photoUrl,
        supplyItemId: remitoForm.supplyItemId || undefined,
        supplyQty: remitoForm.supplyItemId && supplyQtyParsed > 0 ? supplyQtyParsed : undefined,
      })

      resetRemitoForm()
      await load()
    } catch (err) {
      setRemitoError(err instanceof Error ? err.message : "Error al guardar el remito")
    } finally {
      setRemitoSubmitting(false)
    }
  }

  const handleRemitoDelete = async (id: string) => {
    if (!confirm("¿Eliminar este remito?")) return
    await deleteRemito(id)
    setRemitos((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <>
    <div className="page-wrap space-y-6">
      <div>
        <p className="page-eyebrow">Gestión económica</p>
        <h1 className="page-title">Tickets y Compras</h1>
        <p className="page-subtitle">Seguimiento de gastos, compras planificadas y tickets registrados.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Total tickets</p>
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
          <p className="stat-card-sub">{totalVencidas === 1 ? "ticket" : "tickets"}</p>
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

      {/* Facturas / Remitos tabbed section */}
      <div className="card-obra p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            {showFacturas && (
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "facturas" ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"
                }`}
                onClick={() => { setActiveTab("facturas"); resetRemitoForm() }}
              >
                Tickets
              </button>
            )}
            {showRemitos && (
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "remitos" ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"
                }`}
                onClick={() => { setActiveTab("remitos"); resetForm() }}
              >
                Remitos
              </button>
            )}
          </div>
          {activeTab === "facturas" && !showForm && canEditFacturas && (
            <button type="button" className="proj-btn-primary" onClick={() => setShowForm(true)}>
              + Nuevo ticket
            </button>
          )}
          {activeTab === "remitos" && !showRemitoForm && canEditRemitos && (
            <button type="button" className="proj-btn-primary" onClick={() => setShowRemitoForm(true)}>
              + Nuevo remito
            </button>
          )}
        </div>

        {/* ─── FACTURAS TAB ─────────────────────────────────────────── */}
        {activeTab === "facturas" && (
          <>
            {showForm && (
              <div className="mb-6 bg-stone-50 rounded-xl p-4 space-y-4 border border-stone-100">
                <h3 className="font-semibold text-stone-800">Nuevo ticket</h3>

                {!form.photoFile && !extracting && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => pdfRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors
                      ${dragOver ? "border-stone-400 bg-stone-100" : "border-stone-200 hover:border-stone-300 hover:bg-stone-100/60"}`}
                  >
                    <svg width="36" height="36" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-stone-400">
                      <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" />
                      <text x="5" y="13" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif" opacity=".9">PDF</text>
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-medium text-stone-700">Arrastrá o hacé click para subir el PDF</p>
                      <p className="text-xs text-stone-400 mt-0.5">Los datos se extraen automáticamente</p>
                    </div>
                  </div>
                )}

                {extracting && (
                  <div className="flex items-center justify-center gap-3 py-10">
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span className="text-sm text-stone-500">Leyendo PDF…</span>
                  </div>
                )}

                {form.photoFile && !extracting && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center justify-between bg-white border border-stone-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-red-500 shrink-0">
                          <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" />
                          <text x="5" y="13" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">PDF</text>
                        </svg>
                        <span className="text-xs text-stone-600 truncate max-w-[200px]">{form.photoFile.name}</span>
                        {autoFilled && <span className="text-xs text-green-600 font-medium">· Datos extraídos</span>}
                      </div>
                      <button
                        type="button"
                        className="proj-btn-ghost-sm"
                        onClick={() => {
                          if (form.photoPreview) URL.revokeObjectURL(form.photoPreview)
                          setForm(EMPTY_FORM)
                          setAutoFilled(false)
                          if (pdfRef.current) pdfRef.current.value = ""
                        }}
                      >
                        Cambiar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Proveedor</label>
                        <input type="text" className="proj-form-input w-full" value={form.supplier}
                          onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                          placeholder="Ej: Hormicenter SA" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">N° de ticket</label>
                        <input type="text" className="proj-form-input w-full" value={form.invoiceNumber}
                          onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                          placeholder="Ej: 1-00000013" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Monto (ARS) *</label>
                        <input type="text" inputMode="decimal" className="proj-form-input w-full" value={form.amount}
                          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                          placeholder="Ej: 219.307 o 219307" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Fecha *</label>
                        <input type="date" className="proj-form-input w-full" value={form.date}
                          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Vencimiento</label>
                        <input type="date" className="proj-form-input w-full" value={form.dueDate}
                          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                      </div>
                    </div>

                    {formError && <p className="text-sm text-red-600">{formError}</p>}

                    <div className="flex gap-2">
                      <button type="submit" className="proj-btn-primary" disabled={submitting}>
                        {submitting ? "Guardando…" : "Guardar ticket"}
                      </button>
                      <button type="button" className="proj-btn-ghost" onClick={resetForm} disabled={submitting}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {!form.photoFile && !extracting && (
                  <div className="flex justify-end">
                    <button type="button" className="proj-btn-ghost" onClick={resetForm}>Cancelar</button>
                  </div>
                )}

                <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfChange} />
              </div>
            )}

            {loading ? (
              <p className="text-sm text-stone-400">Cargando…</p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-stone-400">No hay tickets registrados aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-stone-100">
                      <th className="pb-2 pr-3 font-medium text-stone-500">N°</th>
                      <th className="pb-2 pr-3 font-medium text-stone-500">Proveedor</th>
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
                        <td className="py-2 pr-3 text-stone-400 text-xs tabular-nums">{inv.invoiceNumber ?? "—"}</td>
                        <td className="py-2 pr-3 font-medium text-stone-800 max-w-[140px] truncate">{inv.supplier}</td>
                        <td className="py-2 pr-3 text-stone-800 font-medium text-right tabular-nums">{fmt(inv.amount)}</td>
                        <td className="py-2 pr-3 text-stone-500 tabular-nums whitespace-nowrap">{fmtDate(inv.date)}</td>
                        <td className="py-2 pr-3 text-stone-500 tabular-nums whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[inv._status]}`}>
                            {STATUS_LABEL[inv._status]}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            {inv.photoUrl && (
                              <button type="button" className="proj-btn-ghost-sm" onClick={() => setPdfPreview(inv.photoUrl!)}>
                                Ver PDF
                              </button>
                            )}
                            {inv._status !== "paid" && (
                              <button type="button" className="proj-btn-ghost-sm" onClick={() => handleMarkPaid(inv.id)}>
                                Marcar pagada
                              </button>
                            )}
                            <button type="button" className="proj-btn-danger-sm" onClick={() => handleDelete(inv.id)}>
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
          </>
        )}

        {/* ─── REMITOS TAB ──────────────────────────────────────────── */}
        {activeTab === "remitos" && (
          <>
            {showRemitoForm && (
              <div className="mb-6 bg-stone-50 rounded-xl p-4 space-y-4 border border-stone-100">
                <h3 className="font-semibold text-stone-800">Nuevo remito</h3>
                <form onSubmit={handleRemitoSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Proveedor *</label>
                      <input type="text" className="proj-form-input w-full" value={remitoForm.supplier} autoFocus
                        onChange={(e) => setRemitoForm((f) => ({ ...f, supplier: e.target.value }))}
                        placeholder="Ej: Hormicenter SA" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">N° de remito</label>
                      <input type="text" className="proj-form-input w-full" value={remitoForm.remitoNumber}
                        onChange={(e) => setRemitoForm((f) => ({ ...f, remitoNumber: e.target.value }))}
                        placeholder="Ej: R-0001234" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Fecha *</label>
                      <input type="date" className="proj-form-input w-full" value={remitoForm.date}
                        onChange={(e) => setRemitoForm((f) => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Descripción {remitoForm.supplyItemId ? <span className="text-stone-400 font-normal">(opcional)</span> : "*"}
                      </label>
                      <input type="text" className="proj-form-input w-full" value={remitoForm.description}
                        onChange={(e) => setRemitoForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Ej: 50 bolsas cemento Portland, 20 varillas 12mm" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-stone-600 mb-1">Foto o PDF del remito</label>
                      {extractingRemito ? (
                        <div className="flex items-center gap-3 border border-stone-200 rounded-lg px-4 py-3 bg-stone-50">
                          <svg className="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          <span className="text-sm text-stone-500">Leyendo PDF…</span>
                        </div>
                      ) : remitoForm.photoPreview && remitoForm.photoFile?.type === "application/pdf" ? (
                        <div className="flex items-center gap-3 border border-stone-200 rounded-lg px-3 py-2 bg-white">
                          <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-red-500 shrink-0">
                            <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" />
                            <text x="5" y="13" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif">PDF</text>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-stone-700 truncate">{remitoForm.photoFile.name}</p>
                            {autoFilledRemito && <p className="text-xs text-green-600 font-medium">Datos extraídos automáticamente</p>}
                          </div>
                          <button type="button" className="proj-btn-ghost-sm shrink-0"
                            onClick={() => {
                              if (remitoForm.photoPreview) URL.revokeObjectURL(remitoForm.photoPreview)
                              setRemitoForm((f) => ({ ...f, photoFile: null, photoPreview: null }))
                              setAutoFilledRemito(false)
                              if (remitoFileRef.current) remitoFileRef.current.value = ""
                            }}>
                            Cambiar
                          </button>
                        </div>
                      ) : remitoForm.photoPreview ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={remitoForm.photoPreview}
                            alt="Vista previa del remito"
                            className="w-20 h-20 object-cover rounded-lg border border-stone-200 cursor-pointer"
                            onClick={() => setImgPreview(remitoForm.photoPreview)}
                          />
                          <button type="button" className="proj-btn-ghost-sm"
                            onClick={() => {
                              if (remitoForm.photoPreview) URL.revokeObjectURL(remitoForm.photoPreview)
                              setRemitoForm((f) => ({ ...f, photoFile: null, photoPreview: null }))
                              if (remitoFileRef.current) remitoFileRef.current.value = ""
                            }}>
                            Cambiar
                          </button>
                        </div>
                      ) : (
                        <button type="button"
                          className="flex items-center gap-2 border border-dashed border-stone-300 rounded-lg px-4 py-3 text-sm text-stone-500 hover:border-stone-400 hover:bg-stone-50 transition-colors w-full"
                          onClick={() => remitoFileRef.current?.click()}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                          Subir foto o PDF (opcional)
                        </button>
                      )}
                      <input ref={remitoFileRef} type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setRemitoForm((f) => ({ ...f, photoFile: file, photoPreview: URL.createObjectURL(file) }))
                          if (file.type === "application/pdf") {
                            setAutoFilledRemito(false)
                            setExtractingRemito(true)
                            extractFromRemitoPdf(file).then((extracted) => {
                              if (Object.keys(extracted).length > 0) {
                                setRemitoForm((f) => ({
                                  ...f,
                                  supplier:     extracted.supplier     ? extracted.supplier     : f.supplier,
                                  remitoNumber: extracted.remitoNumber ? extracted.remitoNumber : f.remitoNumber,
                                  date:         extracted.date         ? extracted.date         : f.date,
                                  description:  extracted.description  ? extracted.description  : f.description,
                                }))
                                setAutoFilledRemito(true)
                              }
                            }).finally(() => setExtractingRemito(false))
                          }
                          e.target.value = ""
                        }} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-stone-600 mb-1">Notas</label>
                      <textarea className="proj-form-input w-full" style={{ minHeight: "4rem", resize: "vertical" }}
                        value={remitoForm.notes}
                        onChange={(e) => setRemitoForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Observaciones, condiciones, etc." />
                    </div>

                    {/* Material vinculado */}
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Material vinculado <span className="text-stone-400 font-normal">(opcional)</span></label>
                      <select
                        className="proj-form-input w-full"
                        value={remitoForm.supplyItemId}
                        onChange={(e) => setRemitoForm((f) => ({ ...f, supplyItemId: e.target.value, supplyQty: "" }))}
                      >
                        <option value="">— Ninguno —</option>
                        {supplies.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                        ))}
                      </select>
                    </div>
                    {remitoForm.supplyItemId && (
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad recibida *</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="proj-form-input w-full"
                          value={remitoForm.supplyQty}
                          onChange={(e) => setRemitoForm((f) => ({ ...f, supplyQty: e.target.value }))}
                          placeholder="0"
                        />
                        <p className="text-xs text-stone-400 mt-1">Se suma automáticamente a <strong>En obra</strong> del material en Stock.</p>
                      </div>
                    )}
                  </div>
                  {remitoError && <p className="text-sm text-red-600">{remitoError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className="proj-btn-primary" disabled={remitoSubmitting}>
                      {remitoSubmitting ? "Guardando…" : "Guardar remito"}
                    </button>
                    <button type="button" className="proj-btn-ghost" onClick={resetRemitoForm}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-stone-400">Cargando…</p>
            ) : remitos.length === 0 ? (
              <p className="text-sm text-stone-400">No hay remitos registrados aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-stone-100">
                      <th className="pb-2 pr-3 font-medium text-stone-500">N°</th>
                      <th className="pb-2 pr-3 font-medium text-stone-500">Proveedor</th>
                      <th className="pb-2 pr-3 font-medium text-stone-500">Descripción</th>
                      <th className="pb-2 pr-3 font-medium text-stone-500">Fecha</th>
                      <th className="pb-2 font-medium text-stone-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remitos.map((r) => {
                      const linkedSupply = r.supplyItemId ? supplies.find((s) => s.id === r.supplyItemId) : undefined
                      return (
                        <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50">
                          <td className="py-2 pr-3 text-stone-400 text-xs tabular-nums">{r.remitoNumber ?? "—"}</td>
                          <td className="py-2 pr-3 font-medium text-stone-800 max-w-[140px] truncate">{r.supplier}</td>
                          <td className="py-2 pr-3 text-stone-600 max-w-[200px]">
                            <p className="truncate">{r.description}</p>
                            {linkedSupply && (
                              <span className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full mt-0.5">
                                📦 {linkedSupply.name}{r.supplyQty ? ` · ${r.supplyQty} ${linkedSupply.unit}` : ""}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-stone-500 tabular-nums whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              {r.photoUrl && (
                                r.photoUrl.toLowerCase().includes(".pdf") ? (
                                  <button type="button" className="proj-btn-ghost-sm" onClick={() => setPdfPreview(r.photoUrl!)}>
                                    Ver PDF
                                  </button>
                                ) : (
                                  <button type="button" className="proj-btn-ghost-sm" onClick={() => setImgPreview(r.photoUrl!)}>
                                    Ver foto
                                  </button>
                                )
                              )}
                              <button type="button" className="proj-btn-danger-sm" onClick={() => handleRemitoDelete(r.id)}>
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>

      {pdfPreview && (
        <div className="photo-lightbox" onClick={() => setPdfPreview(null)}>
          <div className="pdf-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="photo-lightbox-close" onClick={() => setPdfPreview(null)}>✕</button>
            <iframe src={pdfPreview} className="pdf-lightbox-frame" title="Vista previa de factura" />
          </div>
        </div>
      )}

      {imgPreview && (
        <div className="photo-lightbox" onClick={() => setImgPreview(null)}>
          <button type="button" className="photo-lightbox-close" onClick={() => setImgPreview(null)}>✕</button>
          <img
            src={imgPreview}
            alt="Vista previa del remito"
            className="photo-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
