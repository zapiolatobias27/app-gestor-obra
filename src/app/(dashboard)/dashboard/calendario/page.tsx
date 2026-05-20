"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  getCalendarEvents, getPurchaseCalendarEvents, getStockAlertCalendarEvents,
  getInvoiceDueDateCalendarEvents,
  addCalendarEvent, deleteCalendarEvent, markCalendarEventPurchased,
  createPurchaseRequest, addDeliveryCalendarEvent, getSupplies,
} from "@/lib/mock-db"
import { CalendarEvent } from "@/types/project"
import { SupplyItem } from "@/types/stock"

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
  const isAuto = ev.id.startsWith("auto-") || ev.id.startsWith("stock-alert-") || ev.id.startsWith("delivery-") || ev.id.startsWith("invoice-") || ev.id.startsWith("overdue-")
  const icon = isOverdue ? "⚠️" :
    ev.type === "buy"      ? "📦" :
    ev.type === "need"     ? "🏗️" :
    ev.type === "delivery" ? "🚚" :
    ev.type === "invoice"  ? "💳" : "📝"
  return (
    <button type="button" className={cls} onClick={onClick}>
      {icon}{" "}
      {isOverdue ? `Vencido: ${ev.title}` : ev.title}
      {ev.purchaseRequestId && <span className="cal-chip-check"> ✓</span>}
      {isAuto && <span className="cal-chip-auto"> •</span>}
    </button>
  )
}

// ─── Event detail modal ───────────────────────────────────────────────────────

function EventModal({
  ev, userName, supplies, onClose, onDeleted, onPurchased,
}: {
  ev: CalendarEvent
  userName: string
  supplies: SupplyItem[]
  onClose: () => void
  onDeleted: () => void
  onPurchased: () => void
}) {
  const isAuto = ev.id.startsWith("auto-") || ev.id.startsWith("stock-alert-") || ev.id.startsWith("delivery-") || ev.id.startsWith("invoice-")
  const isStockAlert = ev.id.startsWith("stock-alert-")
  const isDelivery = ev.type === "delivery"
  const isInvoice = ev.type === "invoice"
  const [desc, setDesc]     = useState(ev.title)
  const [amount, setAmount] = useState(ev.amount?.toString() ?? "")
  const [sending, setSending] = useState(false)

  const supply = ev.supplyId ? supplies.find((s) => s.id === ev.supplyId) : null

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

  const handleCreatePurchase = () => {
    setSending(true)
    const amt = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0
    createPurchaseRequest(desc || ev.title, amt, userName)
    if (!isAuto) markCalendarEventPurchased(ev.id, `pr-${Date.now()}`)
    // Si es una alerta de stock, crear evento de entrega
    if (isStockAlert && ev.supplyId) {
      const days = ev.deliveryDays ?? 7
      addDeliveryCalendarEvent(ev.supplyId, ev.date, days)
    }
    onPurchased()
    onClose()
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
                  <label className="proj-form-label" htmlFor="cal-amount">Monto estimado ($)</label>
                  <input
                    id="cal-amount"
                    className="proj-form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ej: 50000"
                  />
                </div>
                <button
                  type="button"
                  className="proj-btn-primary"
                  onClick={handleCreatePurchase}
                  disabled={sending}
                >
                  {isStockAlert ? "Confirmar compra realizada" : "Crear pedido de compra"}
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
  date, userName, onClose, onAdded,
}: {
  date: string
  userName: string
  onClose: () => void
  onAdded: () => void
}) {
  const [title, setTitle]   = useState("")
  const [type, setType]     = useState<"buy" | "need" | "note">("note")
  const [amount, setAmount] = useState("")
  const [error, setError]   = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError("Ingresá un título."); return }
    addCalendarEvent({
      date,
      title: title.trim(),
      type,
      material: type !== "note" ? title.trim() : undefined,
      amount: parseFloat(amount.replace(/\./g, "").replace(",", ".")) || undefined,
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
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [addDate, setAddDate] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [manual, auto, stockAlerts, invoiceDues, sups] = await Promise.all([
      getCalendarEvents(),
      getPurchaseCalendarEvents(),
      getStockAlertCalendarEvents(),
      getInvoiceDueDateCalendarEvents(),
      getSupplies(),
    ])
    setAllEvents([...auto, ...stockAlerts, ...invoiceDues, ...manual])
    setSupplies(sups)
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
      <div>
        <p className="page-eyebrow">Planificación</p>
        <h1 className="page-title">Calendario de materiales</h1>
        <p className="page-subtitle">
          📦 Comprar · 🏗️ Necesario en obra · 🚚 Entrega · 📝 Nota — hacé click en un día para agregar
        </p>
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
          onClose={() => setSelectedEvent(null)}
          onDeleted={reload}
          onPurchased={reload}
        />
      )}

      {addDate && !selectedEvent && (
        <AddEventModal
          date={addDate}
          userName={userName}
          onClose={() => setAddDate(null)}
          onAdded={reload}
        />
      )}
    </div>
  )
}
