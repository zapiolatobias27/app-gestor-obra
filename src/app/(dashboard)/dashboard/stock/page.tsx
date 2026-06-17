"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  getSupplies, getStages, getProviders,
  addSupply, updateSupply, deleteSupply,
  updateSupplyRealQty, updateSupplyCurrentStock,
  updateSupplyPurchaseStatus,
} from "@/lib/mock-db"
import { getActiveProjectId } from "@/lib/projects-db"
import { createClient } from "@/lib/supabase/client"
import { parseNum } from "@/lib/parseNum"
import { checkAllDeviations, formatDeviation } from "@/features/stock/logic/deviation-check"
import { PdfStockImporter } from "@/features/import/components/pdf-stock-importer"
import type { Stage } from "@/types/project"
import type { Provider } from "@/types/project"
import type { SupplyItem } from "@/types/stock"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)
}

const PURCHASE_STATUS_LABEL: Record<NonNullable<SupplyItem["purchaseStatus"]>, string> = {
  pending:   "Pendiente",
  ordered:   "Pedido",
  delivered: "Entregado",
  critical:  "Crítico",
}

const PURCHASE_STATUS_CLASS: Record<NonNullable<SupplyItem["purchaseStatus"]>, string> = {
  pending:   "badge-pending",
  ordered:   "badge-progress",
  delivered: "badge-done",
  critical:  "badge-blocked",
}

// ─── Formulario nuevo material ────────────────────────────────────────────────

interface FormState {
  stageId: string
  name: string
  unit: string
  neededQty: string
  stockCompraAnterior: string
  toComprar: string
  totalPurchased: string
  estimatedUnitCost: string
  realUnitCost: string
  totalCompradoPesos: string
  diferenciaPesos: string
  currentStock: string
  realQty: string
  orderWeek: string
  purchaseStatus: SupplyItem["purchaseStatus"]
  providerId: string
  photoFile: File | null
  photoPreview: string | null
}

const EMPTY_FORM: FormState = {
  stageId: "", name: "", unit: "",
  neededQty: "", stockCompraAnterior: "", toComprar: "",
  totalPurchased: "", estimatedUnitCost: "", realUnitCost: "",
  totalCompradoPesos: "", diferenciaPesos: "",
  currentStock: "", realQty: "", orderWeek: "",
  purchaseStatus: undefined, providerId: "",
  photoFile: null, photoPreview: null,
}

function AddSupplyForm({ stages, providers, onAdded }: {
  stages: Stage[]
  providers: Provider[]
  onAdded: () => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState("")
  const [lastAdded, setLastAdded] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof FormState, v: string | File | null | SupplyItem["purchaseStatus"]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleFile = (file: File) => {
    set("photoFile", file)
    set("photoPreview", URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.stageId)     { setError("Seleccioná una etapa."); return }
    if (!form.name.trim()) { setError("Ingresá el nombre del material."); return }
    if (!form.unit.trim()) { setError("Ingresá la unidad."); return }
    setSubmitting(true)
    try {
      let photoUrl: string | undefined
      if (form.photoFile) {
        const pid = getActiveProjectId()
        const ext = form.photoFile.name.split(".").pop() ?? "jpg"
        const path = `remitos/${pid}/${crypto.randomUUID()}.${ext}`
        const supabase = createClient()
        const { error: upErr } = await supabase.storage.from("invoices").upload(path, form.photoFile)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }
      const addedName = form.name.trim()
      await addSupply({
        id: `sup-${Date.now()}`,
        stageId: form.stageId,
        name: addedName,
        unit: form.unit.trim(),
        plannedQty: parseNum(form.totalPurchased) || 0,
        realQty: parseNum(form.realQty) || 0,
        currentStock: parseNum(form.currentStock) || undefined,
        totalPurchased: parseNum(form.totalPurchased) || 0,
        estimatedUnitCost: parseNum(form.estimatedUnitCost) || undefined,
        orderWeek: parseNum(form.orderWeek) || undefined,
        purchaseStatus: form.purchaseStatus,
        providerId: form.providerId || undefined,
        photoUrl,
      })
      setLastAdded(addedName)
      setTimeout(() => setLastAdded(""), 2500)
      setForm((f) => ({ ...EMPTY_FORM, stageId: f.stageId }))
      setError("")
      nameRef.current?.focus()
      onAdded()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error     && <p className="proj-form-error">{error}</p>}
      {lastAdded && (
        <p className="text-sm font-medium" style={{ color: "var(--clay-600)" }}>
          ✓ {lastAdded} agregado — podés seguir cargando
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Etapa */}
        <div className="proj-form-field col-span-2">
          <label className="proj-form-label">Etapa *</label>
          <select className="proj-form-input" value={form.stageId} onChange={(e) => set("stageId", e.target.value)}>
            <option value="">— Seleccioná una etapa —</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>

        {/* Material y unidad */}
        <div className="proj-form-field col-span-2">
          <label className="proj-form-label">Material / Item *</label>
          <input ref={nameRef} className="proj-form-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Cemento Portland" autoFocus />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Unidad *</label>
          <input className="proj-form-input" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="bolsa, m³, kg…" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Semana pedido</label>
          <input type="text" inputMode="numeric" className="proj-form-input" value={form.orderWeek} onChange={(e) => set("orderWeek", e.target.value)} placeholder="ej: 5" />
        </div>

        {/* Cantidades */}
        <div className="proj-form-field">
          <label className="proj-form-label">Comprado total</label>
          <input type="text" inputMode="decimal" className="proj-form-input" value={form.totalPurchased} onChange={(e) => set("totalPurchased", e.target.value)} placeholder="0" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Precio unitario</label>
          <input type="text" inputMode="decimal" className="proj-form-input" value={form.estimatedUnitCost} onChange={(e) => set("estimatedUnitCost", e.target.value)} placeholder="0" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">En obra</label>
          <input type="text" inputMode="decimal" className="proj-form-input" value={form.currentStock} onChange={(e) => set("currentStock", e.target.value)} placeholder="0" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Consumido</label>
          <input type="text" inputMode="decimal" className="proj-form-input" value={form.realQty} onChange={(e) => set("realQty", e.target.value)} placeholder="0" />
        </div>

        {/* Estado y proveedor */}
        <div className="proj-form-field">
          <label className="proj-form-label">Estado compra</label>
          <select className="proj-form-input" value={form.purchaseStatus ?? ""} onChange={(e) => set("purchaseStatus", (e.target.value || undefined) as SupplyItem["purchaseStatus"])}>
            <option value="">— Sin estado —</option>
            <option value="pending">Pendiente</option>
            <option value="ordered">Pedido</option>
            <option value="delivered">Entregado</option>
            <option value="critical">Crítico</option>
          </select>
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Proveedor</label>
          <select className="proj-form-input" value={form.providerId} onChange={(e) => set("providerId", e.target.value)}>
            <option value="">— Sin proveedor —</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Foto */}
        <div className="proj-form-field col-span-2">
          <label className="proj-form-label">Foto comprobante</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="proj-form-input"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
          {form.photoPreview && (
            <img src={form.photoPreview} alt="Vista previa" className="mt-2 rounded-lg object-cover" style={{ width: 80, height: 80 }} />
          )}
        </div>
      </div>

      <button type="submit" className="proj-btn-primary" disabled={submitting}>
        {submitting ? "Guardando…" : "Agregar y continuar"}
      </button>
    </form>
  )
}

// ─── Modal editar material ─────────────────────────────────────────────────────

function EditSupplyModal({ supply, stages, providers, onSaved, onClose }: {
  supply: SupplyItem
  stages: Stage[]
  providers: Provider[]
  onSaved: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>({
    stageId: supply.stageId,
    name: supply.name,
    unit: supply.unit,
    neededQty: String(supply.neededQty ?? supply.plannedQty ?? ""),
    stockCompraAnterior: supply.stockCompraAnterior != null ? String(supply.stockCompraAnterior) : "",
    toComprar: supply.toComprar != null ? String(supply.toComprar) : "",
    totalPurchased: String(supply.totalPurchased ?? 0),
    estimatedUnitCost: String(supply.estimatedUnitCost ?? ""),
    realUnitCost: String(supply.realUnitCost ?? ""),
    totalCompradoPesos: supply.totalCompradoPesos != null ? String(supply.totalCompradoPesos) : "",
    diferenciaPesos: supply.diferenciaPesos != null ? String(supply.diferenciaPesos) : "",
    currentStock: String(supply.currentStock ?? ""),
    realQty: String(supply.realQty),
    orderWeek: String(supply.orderWeek ?? ""),
    purchaseStatus: supply.purchaseStatus,
    providerId: supply.providerId ?? "",
    photoFile: null,
    photoPreview: supply.photoUrl ?? null,
  })
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof FormState, v: string | File | null | SupplyItem["purchaseStatus"]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleFile = (file: File) => {
    set("photoFile", file)
    set("photoPreview", URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let photoUrl = supply.photoUrl
      if (form.photoFile) {
        const pid = getActiveProjectId()
        const ext = form.photoFile.name.split(".").pop() ?? "jpg"
        const path = `remitos/${pid}/${crypto.randomUUID()}.${ext}`
        const supabase = createClient()
        const { error: upErr } = await supabase.storage.from("invoices").upload(path, form.photoFile)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }
      const nq = parseNum(form.neededQty)
      await updateSupply({
        ...supply,
        stageId: form.stageId || supply.stageId,
        name: form.name.trim() || supply.name,
        unit: form.unit.trim() || supply.unit,
        plannedQty: nq || supply.plannedQty,
        neededQty: nq || undefined,
        stockCompraAnterior: form.stockCompraAnterior !== "" ? parseNum(form.stockCompraAnterior) : undefined,
        toComprar: form.toComprar !== "" ? parseNum(form.toComprar) : undefined,
        realQty: parseNum(form.realQty) || 0,
        currentStock: parseNum(form.currentStock) || undefined,
        totalPurchased: parseNum(form.totalPurchased) || 0,
        estimatedUnitCost: parseNum(form.estimatedUnitCost) || undefined,
        realUnitCost: parseNum(form.realUnitCost) || undefined,
        totalCompradoPesos: form.totalCompradoPesos !== "" ? parseNum(form.totalCompradoPesos) : undefined,
        diferenciaPesos: form.diferenciaPesos !== "" ? parseNum(form.diferenciaPesos) : undefined,
        orderWeek: parseNum(form.orderWeek) || undefined,
        purchaseStatus: form.purchaseStatus,
        providerId: form.providerId || undefined,
        photoUrl,
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-100">
          <h3 className="text-base font-semibold text-stone-900">Editar material</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="proj-form-field col-span-2">
              <label className="proj-form-label">Material / Item</label>
              <input className="proj-form-input" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Unidad</label>
              <input className="proj-form-input" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Semana pedido</label>
              <input type="text" inputMode="numeric" className="proj-form-input" value={form.orderWeek} onChange={(e) => set("orderWeek", e.target.value)} />
            </div>

            <div className="col-span-2 pt-1">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Cantidades</p>
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Cantidad necesaria</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.neededQty} onChange={(e) => set("neededQty", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Stock compra anterior</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.stockCompraAnterior} onChange={(e) => set("stockCompraAnterior", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">A comprar</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.toComprar} onChange={(e) => set("toComprar", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Comprado (unidades)</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.totalPurchased} onChange={(e) => set("totalPurchased", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">En obra</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.currentStock} onChange={(e) => set("currentStock", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Consumido</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.realQty} onChange={(e) => set("realQty", e.target.value)} placeholder="0" />
            </div>

            <div className="col-span-2 pt-1">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Precios</p>
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Precio estimado (unit.)</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.estimatedUnitCost} onChange={(e) => set("estimatedUnitCost", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Precio real de compra (unit.)</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.realUnitCost} onChange={(e) => set("realUnitCost", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Total comprado ($)</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.totalCompradoPesos} onChange={(e) => set("totalCompradoPesos", e.target.value)} placeholder="0" />
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Diferencia est. vs real ($)</label>
              <input type="text" inputMode="decimal" className="proj-form-input" value={form.diferenciaPesos} onChange={(e) => set("diferenciaPesos", e.target.value)} placeholder="0" />
            </div>

            <div className="col-span-2 pt-1">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Compra</p>
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Estado compra</label>
              <select className="proj-form-input" value={form.purchaseStatus ?? ""} onChange={(e) => set("purchaseStatus", (e.target.value || undefined) as SupplyItem["purchaseStatus"])}>
                <option value="">— Sin estado —</option>
                <option value="pending">Pendiente</option>
                <option value="ordered">Pedido</option>
                <option value="delivered">Entregado</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
            <div className="proj-form-field">
              <label className="proj-form-label">Proveedor</label>
              <select className="proj-form-input" value={form.providerId} onChange={(e) => set("providerId", e.target.value)}>
                <option value="">— Sin proveedor —</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="proj-form-field col-span-2">
              <label className="proj-form-label">Foto comprobante</label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="proj-form-input"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              {form.photoPreview && (
                <img src={form.photoPreview} alt="Comprobante" className="mt-2 rounded-lg object-cover" style={{ width: 80, height: 80 }} />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-5">
          <button type="button" className="proj-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button type="button" className="proj-btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tabla principal ───────────────────────────────────────────────────────────

function MaterialsTable({ supplies, providers, onEdit, onDelete, onRefresh }: {
  supplies: SupplyItem[]
  providers: Provider[]
  onEdit: (s: SupplyItem) => void
  onDelete: (s: SupplyItem) => void
  onRefresh: () => void
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [editingEnObraId, setEditingEnObraId] = useState<string | null>(null)
  const [editingEnObraVal, setEditingEnObraVal] = useState(0)
  const [editingConsumidoId, setEditingConsumidoId] = useState<string | null>(null)
  const [editingConsumidoVal, setEditingConsumidoVal] = useState(0)

  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p]))

  const saveEnObra = async (id: string) => {
    await updateSupplyCurrentStock(id, editingEnObraVal)
    setEditingEnObraId(null)
    onRefresh()
  }
  const saveConsumido = async (id: string) => {
    await updateSupplyRealQty(id, editingConsumidoVal)
    setEditingConsumidoId(null)
    onRefresh()
  }
  const saveStatus = async (id: string, status: SupplyItem["purchaseStatus"]) => {
    await updateSupplyPurchaseStatus(id, status)
    onRefresh()
  }

  if (supplies.length === 0) {
    return (
      <div className="card-obra p-8 text-center text-stone-400 text-sm">
        No hay materiales registrados. Usá el formulario de arriba para agregar el primero.
      </div>
    )
  }

  return (
    <>
      <div className="card-obra overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="stock-thead">
              <tr>
                <th className="stock-th text-left">Material</th>
                <th className="stock-th text-right">Cant. Nec.</th>
                <th className="stock-th text-right hidden lg:table-cell">Stock Ant.</th>
                <th className="stock-th text-right hidden lg:table-cell">A Comprar</th>
                <th className="stock-th text-right">Comprado</th>
                <th className="stock-th text-right hidden sm:table-cell">P. Est.</th>
                <th className="stock-th text-right hidden sm:table-cell">P. Real</th>
                <th className="stock-th text-right hidden xl:table-cell">Total Comp. ($)</th>
                <th className="stock-th text-right hidden xl:table-cell">Diferencia ($)</th>
                <th className="stock-th text-right">En Obra</th>
                <th className="stock-th text-right">Consumido</th>
                <th className="stock-th text-right">Stock</th>
                <th className="stock-th text-center">Estado</th>
                <th className="stock-th text-left hidden md:table-cell">Proveedor</th>
                <th className="stock-th" />
              </tr>
            </thead>
            <tbody className="stock-tbody">
              {supplies.map((s) => {
                const stock   = s.stockFinal ?? ((s.totalPurchased ?? 0) - s.realQty)
                const isNeg   = stock < 0
                const provider = s.providerId ? providerMap[s.providerId] : undefined
                const waPhone  = provider?.phone?.replace(/\D/g, "")
                const waMsg    = provider
                  ? encodeURIComponent(
                      `Hola ${provider.contactName ?? provider.name}, necesito ${s.totalPurchased} ${s.unit} de ${s.name}` +
                      (s.orderWeek ? ` para la semana ${s.orderWeek}` : "")
                    )
                  : ""

                return (
                  <tr key={s.id} className={`stock-row ${isNeg ? "stock-row-high" : ""}`}>
                    {/* Material */}
                    <td className="stock-td">
                      <div className="flex items-center gap-2">
                        {s.photoUrl && (
                          <button type="button" onClick={() => setLightboxUrl(s.photoUrl!)} className="photo-thumb-btn flex-shrink-0" aria-label="Ver foto">
                            <img src={s.photoUrl} alt="comprobante" className="photo-thumb" />
                          </button>
                        )}
                        <div>
                          <p className="font-semibold">{s.name}</p>
                          <p className="text-xs text-stone-400">{s.unit}</p>
                        </div>
                      </div>
                    </td>

                    {/* Cantidad necesaria */}
                    <td className="stock-td text-right tabular-nums text-stone-600">
                      {s.neededQty ?? s.plannedQty ?? "—"}
                    </td>

                    {/* Stock compra anterior */}
                    <td className="stock-td text-right tabular-nums text-stone-500 hidden lg:table-cell">
                      {s.stockCompraAnterior ?? "—"}
                    </td>

                    {/* A comprar */}
                    <td className="stock-td text-right tabular-nums text-stone-500 hidden lg:table-cell">
                      {s.toComprar ?? "—"}
                    </td>

                    {/* Comprado (unidades) */}
                    <td className="stock-td text-right tabular-nums font-medium">
                      {s.totalPurchased ?? 0}
                    </td>

                    {/* Precio estimado */}
                    <td className="stock-td text-right tabular-nums text-stone-500 hidden sm:table-cell">
                      {s.estimatedUnitCost ? fmt(s.estimatedUnitCost) : "—"}
                    </td>

                    {/* Precio real de compra */}
                    <td className="stock-td text-right tabular-nums text-stone-500 hidden sm:table-cell">
                      {s.realUnitCost ? fmt(s.realUnitCost) : "—"}
                    </td>

                    {/* Total comprado ($) */}
                    <td className="stock-td text-right tabular-nums hidden xl:table-cell">
                      {s.totalCompradoPesos != null ? fmt(s.totalCompradoPesos) : "—"}
                    </td>

                    {/* Diferencia estimado vs real */}
                    <td className={`stock-td text-right tabular-nums hidden xl:table-cell ${
                      s.diferenciaPesos != null
                        ? s.diferenciaPesos > 0 ? "text-red-600" : s.diferenciaPesos < 0 ? "text-green-600" : "text-stone-400"
                        : ""
                    }`}>
                      {s.diferenciaPesos != null ? fmt(s.diferenciaPesos) : "—"}
                    </td>

                    {/* En Obra (editable) */}
                    <td className="stock-td text-right">
                      {editingEnObraId === s.id ? (
                        <input
                          type="number"
                          value={editingEnObraVal}
                          onChange={(e) => setEditingEnObraVal(parseFloat(e.target.value) || 0)}
                          onBlur={() => saveEnObra(s.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEnObra(s.id) }}
                          className="stock-edit-input"
                          autoFocus
                        />
                      ) : (
                        <button type="button" className="stock-edit-btn" title="Clic para editar"
                          onClick={() => { setEditingEnObraId(s.id); setEditingEnObraVal(s.currentStock ?? 0) }}>
                          {s.currentStock != null ? s.currentStock : "—"}
                        </button>
                      )}
                    </td>

                    {/* Consumido (editable) */}
                    <td className="stock-td text-right">
                      {editingConsumidoId === s.id ? (
                        <input
                          type="number"
                          value={editingConsumidoVal}
                          onChange={(e) => setEditingConsumidoVal(parseFloat(e.target.value) || 0)}
                          onBlur={() => saveConsumido(s.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveConsumido(s.id) }}
                          className="stock-edit-input"
                          autoFocus
                        />
                      ) : (
                        <button type="button" className="stock-edit-btn" title="Clic para editar"
                          onClick={() => { setEditingConsumidoId(s.id); setEditingConsumidoVal(s.realQty) }}>
                          {s.realQty || "—"}
                        </button>
                      )}
                    </td>

                    {/* Stock final */}
                    <td className={`stock-td text-right font-bold tabular-nums ${isNeg ? "stock-dev-high" : stock === 0 ? "text-stone-400" : "stock-dev-ok"}`}>
                      {stock}
                    </td>

                    {/* Estado compra */}
                    <td className="stock-td text-center">
                      <select
                        value={s.purchaseStatus ?? ""}
                        onChange={(e) => saveStatus(s.id, (e.target.value || undefined) as SupplyItem["purchaseStatus"])}
                        className={`text-xs rounded-full px-2 py-0.5 font-semibold border-0 cursor-pointer ${
                          s.purchaseStatus ? PURCHASE_STATUS_CLASS[s.purchaseStatus] : "text-stone-400 bg-stone-100"
                        }`}
                        style={{ appearance: "none", textAlign: "center" }}
                        aria-label="Estado de compra"
                      >
                        <option value="">—</option>
                        <option value="pending">Pendiente</option>
                        <option value="ordered">Pedido</option>
                        <option value="delivered">Entregado</option>
                        <option value="critical">Crítico</option>
                      </select>
                    </td>

                    {/* Proveedor */}
                    <td className="stock-td hidden md:table-cell">
                      {provider ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-stone-600 text-xs">{provider.name}</span>
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}?text=${waMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="provider-wa-btn"
                              title="Pedir por WhatsApp"
                              style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}
                            >
                              WA
                            </a>
                          )}
                        </div>
                      ) : s.providerName ? (
                        <span className="text-stone-600 text-xs">{s.providerName}</span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="stock-td">
                      <div className="flex gap-1 justify-end">
                        <button type="button" className="proj-btn-ghost-sm" onClick={() => onEdit(s)}>Editar</button>
                        <button type="button" className="proj-btn-danger-sm" onClick={() => onDelete(s)}>✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox foto */}
      {lightboxUrl && (
        <div className="photo-lightbox" onClick={() => setLightboxUrl(null)}>
          <button type="button" className="photo-lightbox-close" onClick={() => setLightboxUrl(null)}>✕</button>
          <img src={lightboxUrl} alt="Comprobante" className="photo-lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [supplies, setSupplies]     = useState<SupplyItem[]>([])
  const [stages, setStages]         = useState<Stage[]>([])
  const [providers, setProviders]   = useState<Provider[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPdfImporter, setShowPdfImporter] = useState(false)
  const [editingSupply, setEditingSupply] = useState<SupplyItem | null>(null)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState("")

  const load = async () => {
    const [s, st, pr] = await Promise.all([getSupplies(), getStages(), getProviders()])
    setSupplies(s)
    setStages(st)
    setProviders(pr)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deviations = supplies.length > 0 ? checkAllDeviations(supplies) : []
  const highAlerts   = deviations.filter((a) => a.severity === "high")
  const mediumAlerts = deviations.filter((a) => a.severity === "medium")

  const handleDelete = async (supply: SupplyItem) => {
    if (!confirm(`¿Eliminar "${supply.name}"?`)) return
    await deleteSupply(supply.id)
    await load()
  }

  const totalComprado = supplies.reduce((s, i) => s + (i.totalPurchased ?? 0) * (i.estimatedUnitCost ?? 0), 0)
  const critical      = supplies.filter((s) => s.purchaseStatus === "critical").length
  const delivered     = supplies.filter((s) => s.purchaseStatus === "delivered").length

  return (
    <div className="page-wrap space-y-6">
      <div>
        <p className="page-eyebrow">Control de inventario</p>
        <h1 className="page-title">Planilla de Materiales</h1>
        <p className="page-subtitle">
          Comprado · En obra · Consumido · Stock calculado · Estado de compra · WhatsApp al proveedor
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Materiales</p>
          <p className="stat-card-value">{supplies.length}</p>
          <p className="stat-card-sub">{delivered} entregados</p>
        </div>
        <div className={`stat-card ${critical > 0 ? "stat-card-accent-red" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Críticos</p>
          <p className="stat-card-value">{critical}</p>
          <p className="stat-card-sub">Estado crítico</p>
        </div>
        <div className={`stat-card ${highAlerts.length > 0 ? "stat-card-accent-orange" : "stat-card-accent-green"}`}>
          <p className="stat-card-label">Desvíos altos</p>
          <p className="stat-card-value">{highAlerts.length}</p>
          <p className="stat-card-sub">Más del 15%</p>
        </div>
        <div className="stat-card stat-card-accent-blue">
          <p className="stat-card-label">Total estimado</p>
          <p className="stat-card-value" style={{ fontSize: "1.1rem" }}>
            {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", notation: "compact", maximumFractionDigits: 1 }).format(totalComprado)}
          </p>
          <p className="stat-card-sub">comprado × precio</p>
        </div>
      </div>

      {/* Agregar material */}
      <div className="card-obra p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="section-title">Agregar material</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className={showPdfImporter ? "proj-btn-ghost-sm" : "proj-btn-ghost-sm"}
              onClick={() => { setShowPdfImporter((v) => !v); setShowAddForm(false) }}
            >
              {showPdfImporter ? "Cancelar PDF" : "↑ Importar PDF"}
            </button>
            <button
              type="button"
              className={showAddForm ? "proj-btn-ghost-sm" : "proj-btn-primary"}
              onClick={() => { setShowAddForm((v) => !v); setShowPdfImporter(false) }}
            >
              {showAddForm ? "Cancelar" : "+ Nuevo material"}
            </button>
          </div>
        </div>
        {showPdfImporter && (
          <PdfStockImporter
            stages={stages}
            onImported={async () => { setShowPdfImporter(false); await load() }}
          />
        )}
        {showAddForm && <AddSupplyForm stages={stages} providers={providers} onAdded={async () => { await load() }} />}
        {!showAddForm && !showPdfImporter && (
          <p className="text-sm text-stone-400">Agregá materiales manualmente o importá desde tu planilla PDF.</p>
        )}
      </div>

      {/* Buscador */}
      {!loading && supplies.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar material…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="proj-form-input w-full pl-9 py-2"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-stone-400 text-center py-8">Cargando materiales…</p>
      ) : (
        <MaterialsTable
          supplies={[...supplies]
            .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
            const aDelivered = a.purchaseStatus === "delivered" ? 0 : 1
            const bDelivered = b.purchaseStatus === "delivered" ? 0 : 1
            if (aDelivered !== bDelivered) return aDelivered - bDelivered
            return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          })}
          providers={providers}
          onEdit={(s) => setEditingSupply(s)}
          onDelete={handleDelete}
          onRefresh={load}
        />
      )}

      {/* Desvíos (colapsados al fondo) */}
      {deviations.length > 0 && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-3">Alertas de Desvío</h2>
          <div className="space-y-2">
            {deviations.map((alert) => (
              <div key={alert.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm
                ${alert.severity === "high" ? "stock-row-high badge-blocked" : "stock-row-medium badge-pending"}`}>
                <div>
                  <p className="font-semibold">{alert.supplyName}</p>
                  <p className="text-xs mt-0.5 opacity-75">
                    Teórico: {alert.plannedQty} → Real: {alert.realQty}
                  </p>
                </div>
                <span className="font-bold tabular-nums text-base">{formatDeviation(alert.deviationPct)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editingSupply && (
        <EditSupplyModal
          supply={editingSupply}
          stages={stages}
          providers={providers}
          onSaved={load}
          onClose={() => setEditingSupply(null)}
        />
      )}
    </div>
  )
}
