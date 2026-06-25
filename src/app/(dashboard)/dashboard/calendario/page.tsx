"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  getCalendarEvents, getPurchaseCalendarEvents, getStockAlertCalendarEvents,
  getSupplyCalendarEvents, getInvoiceDueDateCalendarEvents,
  addCalendarEvent, deleteCalendarEvent, markCalendarEventPurchased,
  createPurchaseRequest, addDeliveryCalendarEvent, getSupplies,
  deleteAllCalendarEvents, getProviders,
  getCalendarEventLinks, setCalendarEventLink, clearCalendarEventLink,
} from "@/lib/mock-db"
import { CalendarEvent, Provider } from "@/types/project"
import { SupplyItem } from "@/types/stock"
import { getActiveProject } from "@/lib/projects-db"
import { CalendarImporter } from "@/features/import/components/calendar-importer"
import { MessageCircle, Phone } from "lucide-react"

const TYPE_LABEL: Record<CalendarEvent["type"], string> = {
  buy:      "📦 Comprar",
  need:     "🏗️ Necesario",
  note:     "📝 Nota",
  delivery: "🚚 Entrega",
  invoice:  "💳 Vto. Factura",
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7 // 0=Mon
  const cells: Date[] = []
  for (let i = -startDow; i < last.getDate(); i++) {
    cells.push(new Date(year, month, 1 + i))
  }
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, cells.length - last.getDate() - startDow + 1))
  }
  return cells
}

function buildWhatsAppUrl(phone: string, message?: string): string {
  // Limpia el número: saca espacios, guiones, paréntesis, el 0 inicial y el 15 de celular argentino
  const digits = phone.replace(/\D/g, "")
  let clean = digits
  if (clean.startsWith("0")) clean = clean.slice(1)
  // Agregar código de país Argentina 54
  const international = clean.startsWith("54") ? clean : `54${clean}`
  const text = message ? encodeURIComponent(message) : ""
  return `https://wa.me/${international}${text ? `?text=${text}` : ""}`
}

// ─── Resolución evento → material → proveedor ─────────────────────────────────

// Clave estable para guardar el vínculo manual. Los chips de compra autogenerados
// comparten purchaseId, así que el override se guarda por entidad subyacente.
function eventLinkKey(ev: CalendarEvent): string {
  if (ev.purchaseId) return `purchase:${ev.purchaseId}`
  return `event:${ev.id}`
}

// Devuelve el SupplyItem asociado al evento siguiendo la cadena de prioridad:
// 1) override manual  2) supplyId directo  3) match por nombre  4) null
function resolveEventSupply(
  ev: CalendarEvent,
  supplies: SupplyItem[],
  links: Record<string, string>,
): SupplyItem | null {
  const overrideId = links[eventLinkKey(ev)]
  if (overrideId) {
    const s = supplies.find((x) => x.id === overrideId)
    if (s) return s
  }
  if (ev.supplyId) {
    const s = supplies.find((x) => x.id === ev.supplyId)
    if (s) return s
  }
  const target = (ev.material ?? ev.title ?? "").toLowerCase().trim()
  if (!target) return null
  // Exacto
  let m = supplies.find((s) => s.name.toLowerCase().trim() === target)
  if (m) return m
  // Substring: el nombre del material está contenido en el título del evento
  m = supplies.find((s) => {
    const name = s.name.toLowerCase().trim()
    return name.length > 2 && (target.startsWith(name) || target.includes(name))
  })
  return m ?? null
}

function buildWaMessage(provider: Provider, supply: SupplyItem | null, fallbackMaterial?: string): string {
  const who = provider.contactName ?? provider.name
  if (supply) {
    const qty = supply.toComprar ?? supply.plannedQty ?? supply.totalPurchased
    const qtyTxt = qty && qty > 0 ? `${qty} ${supply.unit} de ` : ""
    return `Hola ${who}, necesito ${qtyTxt}${supply.name}.`
  }
  const mat = fallbackMaterial ? ` de ${fallbackMaterial}` : ""
  return `Hola ${who}, te contacto por el suministro${mat}.`
}

// ─── Provider card (dentro del modal) ────────────────────────────────────────

function ProviderCard({ provider, message }: { provider: Provider; message: string }) {
  return (
    <div className="cal-provider-card">
      <p className="cal-provider-name">{provider.name}</p>
      {provider.contactName && (
        <p className="cal-provider-meta">Contacto: {provider.contactName}</p>
      )}
      {provider.supplies && (
        <p className="cal-provider-meta">Provee: {provider.supplies}</p>
      )}
      <div className="cal-provider-actions">
        {provider.phone && (
          <>
            <a
              href={buildWhatsAppUrl(provider.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="cal-provider-btn cal-provider-btn-wpp"
            >
              <MessageCircle size={15} />
              WhatsApp
            </a>
            <a
              href={`tel:${provider.phone}`}
              className="cal-provider-btn cal-provider-btn-phone"
            >
              <Phone size={15} />
              Llamar
            </a>
          </>
        )}
        {!provider.phone && (
          <p className="cal-provider-no-phone">Sin teléfono registrado</p>
        )}
      </div>
    </div>
  )
}

// ─── Event chip ───────────────────────────────────────────────────────────────

function EventChip({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  const isOverdue = ev.id.startsWith("overdue-")
  const cls =
    isOverdue              ? "cal-chip cal-chip-overdue" :
    ev.type === "buy"      ? "cal-chip cal-chip-buy" :
    ev.type === "need"     ? "cal-chip cal-chip-need" :
    ev.type === "delivery" ? "cal-chip cal-chip-delivery" :
    ev.type === "invoice"  ? "cal-chip cal-chip-invoice" :
                             "cal-chip cal-chip-note"
  const isAuto = ev.id.startsWith("auto-") || ev.id.startsWith("stock-alert-") || ev.id.startsWith("supply-week-") || ev.id.startsWith("delivery-") || ev.id.startsWith("invoice-") || ev.id.startsWith("overdue-")
  const icon = isOverdue ? "⚠️" :
    ev.type === "buy"      ? "📦" :
    ev.type === "need"     ? "🏗️" :
    ev.type === "delivery" ? "🚚" :
    ev.type === "invoice"  ? "💳" : "📝"
  return (
    <button type="button" className={cls} onClick={(e) => { e.stopPropagation(); onClick() }}>
      {icon}{" "}
      {isOverdue ? `Vencido: ${ev.title}` : ev.title}
      {ev.purchaseRequestId && <span className="cal-chip-check"> ✓</span>}
      {isAuto && <span className="cal-chip-auto"> •</span>}
    </button>
  )
}

// ─── Event detail modal ───────────────────────────────────────────────────────

function EventModal({
  ev, userName, supplies, providers, links, onClose, onDeleted, onPurchased, onLinkChanged,
}: {
  ev: CalendarEvent
  userName: string
  supplies: SupplyItem[]
  providers: Provider[]
  links: Record<string, string>
  onClose: () => void
  onDeleted: () => void
  onPurchased: () => void
  onLinkChanged: () => void
}) {
  const isAuto = ev.id.startsWith("auto-") || ev.id.startsWith("stock-alert-") || ev.id.startsWith("supply-week-") || ev.id.startsWith("delivery-") || ev.id.startsWith("invoice-")
  const isStockAlert = ev.id.startsWith("stock-alert-")
  const isDelivery = ev.type === "delivery"
  const isInvoice = ev.type === "invoice"
  const canLink = ev.type === "buy" || ev.type === "need"
  const [desc, setDesc]     = useState(ev.title)
  const [amount, setAmount] = useState(ev.amount?.toString() ?? "")
  const [sending, setSending] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Cadena evento → material → proveedor
  const supply = resolveEventSupply(ev, supplies, links)
  const resolvedProviderId = supply?.providerId ?? ev.providerId
  const provider = resolvedProviderId ? providers.find((p) => p.id === resolvedProviderId) : null
  const waMessage = provider ? buildWaMessage(provider, supply, ev.material ?? ev.title) : ""

  // Calcular días restantes de stock para mostrar en el modal
  let daysLeft: number | null = null
  let weeklyConsumption: number | null = null
  if (supply && supply.currentStock != null && supply.currentStock > 0) {
    const wc = supply.weeklyConsumption ?? 0
    weeklyConsumption = wc > 0 ? wc : null
    if (weeklyConsumption) {
      daysLeft = Math.floor((supply.currentStock / weeklyConsumption) * 7)
    }
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])

  const handleLinkChange = async (supplyId: string) => {
    setError(null)
    try {
      if (supplyId) {
        await setCalendarEventLink(eventLinkKey(ev), supplyId)
      } else {
        await clearCalendarEventLink(eventLinkKey(ev))
      }
      onLinkChanged()
    } catch (err) {
      console.error(err)
      setError("No se pudo vincular el material. Intentá de nuevo.")
    }
  }

  const handleBuy = async () => {
    setError(null)
    setSending(true)
    try {
      const amt = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0
      if (amt <= 0 && !provider) {
        setError("Ingresá un monto o vinculá un material con proveedor.")
        return
      }
      // Crear pedido sólo si hay monto válido
      if (amt > 0) {
        await createPurchaseRequest(desc || ev.title, amt, userName)
        if (!isAuto) await markCalendarEventPurchased(ev.id, `pr-${Date.now()}`)
        // Si es una alerta de stock, agendar la entrega
        if (isStockAlert && ev.supplyId) {
          await addDeliveryCalendarEvent(ev.supplyId, ev.date, ev.deliveryDays ?? 7)
        }
        onPurchased()
      }
      // Abrir WhatsApp si hay proveedor con teléfono
      if (provider?.phone) {
        window.open(buildWhatsAppUrl(provider.phone, waMessage), "_blank", "noopener,noreferrer")
      }
      if (amt > 0) onClose()
    } catch (err) {
      console.error(err)
      setError("No se pudo crear el pedido. Intentá de nuevo.")
    } finally {
      setSending(false)
    }
  }

  const handleDelete = () => {
    if (confirm(`¿Eliminar evento "${ev.title}"?`)) {
      deleteCalendarEvent(ev.id)
      onDeleted()
      onClose()
    }
  }

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <span className={`cal-modal-type-badge cal-chip-${ev.type}`}>
            {TYPE_LABEL[ev.type]}
          </span>
          <button type="button" className="cal-modal-close" onClick={onClose}>✕</button>
        </div>

        <h3 className="cal-modal-title">{ev.title}</h3>
        <p className="cal-modal-date">{ev.date}</p>

        {ev.material && (
          <p className="cal-modal-meta">Material: <strong>{ev.material}</strong></p>
        )}

        {/* Proveedor asociado */}
        {provider && (
          <div className="cal-provider-section">
            <p className="cal-provider-section-label">Proveedor</p>
            <ProviderCard provider={provider} message={waMessage} />
          </div>
        )}

        {/* Nota: material no está en el stock */}
        {canLink && !supply && (
          <p className="cal-stock-note">
            Este material no figura en el stock. Vinculalo abajo o cargalo en la sección Stock.
          </p>
        )}

        {/* Selector de vínculo manual con un material del stock */}
        {canLink && supplies.length > 0 && (
          <div className="proj-form-field">
            <label className="proj-form-label" htmlFor="cal-link-supply">
              Material del stock vinculado
            </label>
            <select
              id="cal-link-supply"
              className="proj-form-input"
              value={supply?.id ?? ""}
              onChange={(e) => handleLinkChange(e.target.value)}
            >
              <option value="">— Sin vincular —</option>
              {supplies.map((s) => {
                const prov = s.providerId ? providers.find((p) => p.id === s.providerId) : null
                return (
                  <option key={s.id} value={s.id}>
                    {s.name}{prov ? ` — ${prov.name}` : ""}
                  </option>
                )
              })}
            </select>
          </div>
        )}

        {/* Contexto de stock para alertas automáticas */}
        {isStockAlert && supply && (
          <div className="cal-stock-context">
            {supply.currentStock != null && (
              <p className="cal-stock-row">
                <span className="cal-stock-label">Stock actual:</span>
                <strong>{supply.currentStock} {supply.unit}</strong>
              </p>
            )}
            {weeklyConsumption != null && (
              <p className="cal-stock-row">
                <span className="cal-stock-label">Consumo estimado:</span>
                <strong>{weeklyConsumption.toFixed(1)} {supply.unit}/semana</strong>
              </p>
            )}
            {daysLeft != null && (
              <p className="cal-stock-row">
                <span className="cal-stock-label">Se agotan en:</span>
                <strong className={daysLeft <= 7 ? "cal-stock-urgent" : ""}>{daysLeft} días</strong>
              </p>
            )}
            {ev.deliveryDays != null && (
              <p className="cal-stock-row">
                <span className="cal-stock-label">Plazo proveedor:</span>
                <strong>{ev.deliveryDays} días</strong>
              </p>
            )}
          </div>
        )}

        {isDelivery && (
          <p className="cal-modal-meta cal-delivery-note">
            ✓ Entrega programada — confirmar recepción en Stock
          </p>
        )}

        {isInvoice && (
          <div className="cal-stock-context">
            {ev.amount != null && (
              <p className="cal-stock-row">
                <span className="cal-stock-label">Monto:</span>
                <strong>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(ev.amount)}</strong>
              </p>
            )}
            <p className="cal-modal-meta" style={{ marginTop: "0.5rem", color: "#7c2d12" }}>
              Factura pendiente de pago — ver detalles en Facturas
            </p>
          </div>
        )}

        {ev.type === "buy" && (
          <div className="cal-modal-purchase">
            {ev.purchaseRequestId ? (
              <p className="cal-modal-purchased">✓ Pedido de compra enviado</p>
            ) : (
              <>
                <p className="cal-modal-purchase-label">Crear pedido de compra</p>
                <div className="proj-form-field">
                  <label className="proj-form-label" htmlFor="cal-desc">Descripción</label>
                  <input
                    id="cal-desc"
                    className="proj-form-input"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Ej: Hormigón H21"
                  />
                </div>
                <div className="proj-form-field">
                  <label className="proj-form-label" htmlFor="cal-amount">Monto estimado ($){provider ? " (opcional)" : ""}</label>
                  <input
                    id="cal-amount"
                    className="proj-form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ej: 50000"
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="button"
                  className="proj-btn-primary"
                  onClick={handleBuy}
                  disabled={sending}
                >
                  {provider
                    ? (isStockAlert ? "Confirmar compra y avisar al proveedor" : "Crear pedido y abrir WhatsApp")
                    : (isStockAlert ? "Confirmar compra realizada" : "Crear pedido de compra")}
                </button>
                {isStockAlert && (
                  <p className="cal-stock-hint">
                    Al confirmar se agendará la entrega automáticamente
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {!isAuto && (
          <button
            type="button"
            className="proj-btn-danger-sm cal-modal-delete-btn"
            onClick={handleDelete}
          >
            Eliminar evento
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Add event modal ──────────────────────────────────────────────────────────

function AddEventModal({
  date, userName, supplies, onClose, onAdded,
}: {
  date: string
  userName: string
  supplies: SupplyItem[]
  onClose: () => void
  onAdded: () => void
}) {
  const [title, setTitle]       = useState("")
  const [type, setType]         = useState<"buy" | "need" | "note">("note")
  const [amount, setAmount]     = useState("")
  const [supplyId, setSupplyId] = useState("")
  const [error, setError]       = useState("")

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError("Ingresá un título."); return }
    addCalendarEvent({
      date,
      title: title.trim(),
      type,
      material: type !== "note" ? title.trim() : undefined,
      amount: parseFloat(amount.replace(/\./g, "").replace(",", ".")) || undefined,
      supplyId: supplyId || undefined,
      createdBy: userName,
    })
    onAdded()
    onClose()
  }

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <h3 className="cal-modal-title">Agregar evento</h3>
          <button type="button" className="cal-modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="cal-modal-date">{date}</p>

        <form onSubmit={handleSubmit} className="cal-modal-form">
          {error && <p className="proj-form-error">{error}</p>}

          <div className="proj-form-field">
            <label className="proj-form-label" htmlFor="cal-event-type">Tipo</label>
            <select id="cal-event-type" title="Tipo de evento" className="proj-form-input" value={type} onChange={(e) => setType(e.target.value as "buy" | "need" | "note")}>
              <option value="buy">📦 Comprar material</option>
              <option value="need">🏗️ Material necesario en obra</option>
              <option value="note">📝 Nota</option>
            </select>
          </div>

          <div className="proj-form-field">
            <label className="proj-form-label" htmlFor="cal-event-title">Título / Material *</label>
            <input
              id="cal-event-title"
              className="proj-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Hormigón H21"
            />
          </div>

          {type !== "note" && (
            <>
              <div className="proj-form-field">
                <label className="proj-form-label" htmlFor="cal-add-amount">Monto estimado ($)</label>
                <input
                  id="cal-add-amount"
                  className="proj-form-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 80000"
                />
              </div>

              {supplies.length > 0 && (
                <div className="proj-form-field">
                  <label className="proj-form-label" htmlFor="cal-add-supply">Material del stock (opcional)</label>
                  <select
                    id="cal-add-supply"
                    className="proj-form-input"
                    value={supplyId}
                    onChange={(e) => setSupplyId(e.target.value)}
                  >
                    <option value="">Sin vincular al stock</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <button type="submit" className="proj-btn-primary">Guardar evento</button>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const [userName, setUserName] = useState("")
  const [projectStartDate, setProjectStartDate] = useState("")
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [links, setLinks] = useState<Record<string, string>>({})
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [addDate, setAddDate] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  const handleDeleteAll = async () => {
    if (!confirm("¿Eliminar TODOS los eventos del calendario de este proyecto? Esta acción no se puede deshacer.")) return
    setDeletingAll(true)
    try {
      await deleteAllCalendarEvents()
      await reload()
    } finally {
      setDeletingAll(false)
    }
  }

  const reload = useCallback(async () => {
    const [manual, auto, stockAlerts, supplyEvents, invoiceDues, sups, provs, lks] = await Promise.all([
      getCalendarEvents(),
      getPurchaseCalendarEvents(),
      getStockAlertCalendarEvents(),
      getSupplyCalendarEvents(),
      getInvoiceDueDateCalendarEvents(),
      getSupplies(),
      getProviders(),
      getCalendarEventLinks(),
    ])
    setAllEvents([...auto, ...stockAlerts, ...supplyEvents, ...invoiceDues, ...manual])
    setSupplies(sups)
    setProviders(provs)
    setLinks(lks)
  }, [])

  useEffect(() => {
    async function init() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
        setUserName(profile?.name ?? "")
      }
      const project = await getActiveProject()
      setProjectStartDate(project?.startDate ?? "")
      reload()
    }
    init()
  }, [reload])

  const cells = getMonthGrid(year, month)
  const todayKey = toDateKey(today)

  const eventsByDate = allEvents.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = []
    acc[ev.date].push(ev)
    return acc
  }, {})

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="page-wrap">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Planificación</p>
          <h1 className="page-title">Calendario de materiales</h1>
          <p className="page-subtitle">
            📦 Comprar · 🏗️ Necesario en obra · 🚚 Entrega · 📝 Nota — hacé click en un día para agregar
          </p>
        </div>
        <button
          type="button"
          className="proj-btn-ghost shrink-0 mt-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleDeleteAll}
          disabled={deletingAll}
        >
          {deletingAll ? "Eliminando…" : "Borrar todo"}
        </button>
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-chip cal-chip-buy">📦 Comprar</span>
        <span className="cal-chip cal-chip-need">🏗️ Necesario</span>
        <span className="cal-chip cal-chip-delivery">🚚 Entrega</span>
        <span className="cal-chip cal-chip-invoice">💳 Vto. Factura</span>
        <span className="cal-chip cal-chip-overdue">⚠️ Vencido</span>
        <span className="cal-chip cal-chip-note">📝 Nota</span>
        <span className="cal-legend-auto">• = automático</span>
      </div>

      {/* Header nav */}
      <div className="cal-nav">
        <button type="button" className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <h2 className="cal-nav-title">{MONTHS[month]} {year}</h2>
        <button type="button" className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      {/* Day headers */}
      <div className="cal-grid">
        {DAYS.map((d) => (
          <div key={d} className="cal-day-header">{d}</div>
        ))}

        {/* Cells */}
        {cells.map((cellDate) => {
          const key      = toDateKey(cellDate)
          const isToday  = key === todayKey
          const isCurrent = cellDate.getMonth() === month
          const events   = eventsByDate[key] ?? []

          return (
            <div
              key={key}
              className={[
                "cal-cell",
                isToday    ? "cal-cell-today"       : "",
                !isCurrent ? "cal-cell-other-month"  : "",
              ].join(" ")}
              onClick={() => setAddDate(key)}
            >
              <span className="cal-cell-number">{cellDate.getDate()}</span>
              <div className="cal-cell-events">
                {events.map((ev) => (
                  <EventChip
                    key={ev.id}
                    ev={ev}
                    onClick={() => setSelectedEvent(ev)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {selectedEvent && (
        <EventModal
          ev={selectedEvent}
          userName={userName}
          supplies={supplies}
          providers={providers}
          links={links}
          onClose={() => setSelectedEvent(null)}
          onDeleted={reload}
          onPurchased={reload}
          onLinkChanged={reload}
        />
      )}

      {addDate && !selectedEvent && (
        <AddEventModal
          date={addDate}
          userName={userName}
          supplies={supplies}
          onClose={() => setAddDate(null)}
          onAdded={reload}
        />
      )}

      {/* Importar desde Excel */}
      <div className="card-obra p-5">
        <h2 className="section-title">Importar desde Excel</h2>
        <p className="text-sm text-stone-400 mb-4">Lee la hoja "Calendario Compras" de tu planilla y agrega los eventos de compra.</p>
        <CalendarImporter projectStartDate={projectStartDate} onImported={reload} />
      </div>
    </div>
  )
}
