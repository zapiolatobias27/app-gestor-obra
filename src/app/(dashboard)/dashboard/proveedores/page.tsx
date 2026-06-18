"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { getProviders, addProvider, updateProvider, deleteProvider, getSupplies, updateSupplyProvider } from "@/lib/mock-db"
import { getActiveProjectId } from "@/lib/projects-db"
import type { Provider } from "@/types/project"
import type { SupplyItem } from "@/types/stock"

const EMPTY_FORM = {
  name: "", phone: "", email: "", contactName: "", supplies: "", address: "", notes: "",
}

type FormState = typeof EMPTY_FORM

function ProviderForm({
  initial,
  supplies,
  initialSupplyIds,
  assignedElsewhere,
  onSave,
  onCancel,
}: {
  initial?: FormState
  supplies: SupplyItem[]
  initialSupplyIds: string[]
  assignedElsewhere: Record<string, string>
  onSave: (f: FormState, supplyIds: string[]) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm]       = useState<FormState>(initial ?? EMPTY_FORM)
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSupplyIds))
  const [matSearch, setMatSearch] = useState("")
  const [error, setError]     = useState("")
  const [saving, setSaving]   = useState(false)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const toggleSupply = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const filteredSupplies = matSearch.trim()
    ? supplies.filter((s) => s.name.toLowerCase().includes(matSearch.toLowerCase()))
    : supplies

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("El nombre del proveedor es obligatorio."); return }
    setSaving(true)
    setError("")
    try { await onSave(form, Array.from(selected)) } catch { setError("Error al guardar. Intentá de nuevo.") }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="proj-form-error">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="proj-form-field sm:col-span-2">
          <label className="proj-form-label">Nombre *</label>
          <input className="proj-form-input" value={form.name} onChange={set("name")} placeholder="Ej: Ferretería López" autoFocus />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Teléfono</label>
          <input className="proj-form-input" value={form.phone} onChange={set("phone")} placeholder="Ej: 3511111111 o +54 351 111-1111" type="tel" />
          <p style={{ fontSize: "0.7rem", color: "var(--stone-400)", marginTop: "0.2rem" }}>
            Cualquier formato — se usa para llamar y abrir WhatsApp
          </p>
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Email</label>
          <input className="proj-form-input" value={form.email} onChange={set("email")} placeholder="contacto@proveedor.com" type="email" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Contacto</label>
          <input className="proj-form-input" value={form.contactName} onChange={set("contactName")} placeholder="Nombre de la persona de contacto" />
        </div>
        <div className="proj-form-field">
          <label className="proj-form-label">Qué provee</label>
          <input className="proj-form-input" value={form.supplies} onChange={set("supplies")} placeholder="Ej: Hierro, cemento, arena" />
        </div>
        <div className="proj-form-field sm:col-span-2">
          <label className="proj-form-label">Dirección</label>
          <input className="proj-form-input" value={form.address} onChange={set("address")} placeholder="Calle y número, ciudad" />
        </div>
        <div className="proj-form-field sm:col-span-2">
          <label className="proj-form-label">Notas</label>
          <textarea
            className="proj-form-input"
            style={{ minHeight: "4rem", resize: "vertical" }}
            value={form.notes}
            onChange={set("notes")}
            placeholder="Condiciones de pago, tiempos de entrega, observaciones..."
          />
        </div>
      </div>

      {/* Vincular materiales del stock */}
      <div className="proj-form-field">
        <label className="proj-form-label">Materiales que provee (del stock)</label>
        {supplies.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--stone-400)" }}>
            Todavía no hay materiales cargados en el stock.
          </p>
        ) : (
          <>
            <p style={{ fontSize: "0.72rem", color: "var(--stone-400)", marginTop: "-0.15rem", marginBottom: "0.4rem" }}>
              Tildá los materiales que provee. Quedan vinculados para pedir por WhatsApp desde Stock y Calendario.
              {selected.size > 0 && ` · ${selected.size} seleccionado${selected.size !== 1 ? "s" : ""}`}
            </p>
            {supplies.length > 6 && (
              <input
                type="search"
                className="proj-form-input"
                style={{ marginBottom: "0.5rem" }}
                placeholder="Buscar material..."
                value={matSearch}
                onChange={(e) => setMatSearch(e.target.value)}
              />
            )}
            <div className="provider-mat-list">
              {filteredSupplies.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--stone-400)", padding: "0.4rem" }}>Sin resultados</p>
              ) : (
                filteredSupplies.map((s) => {
                  const other = assignedElsewhere[s.id]
                  return (
                    <label key={s.id} className="provider-mat-item">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSupply(s.id)}
                      />
                      <span className="provider-mat-name">{s.name}</span>
                      {other && !selected.has(s.id) && (
                        <span className="provider-mat-other">ya: {other}</span>
                      )}
                    </label>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" className="proj-btn-primary" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" className="proj-btn-ghost-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

function ProviderCard({
  provider,
  materials,
  onEdit,
  onDelete,
}: {
  provider: Provider
  materials: SupplyItem[]
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="provider-card">
      <div className="provider-card-header">
        <div className="provider-card-avatar">
          {provider.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="provider-card-name">{provider.name}</h3>
          {provider.supplies && (
            <p className="provider-card-supplies">{provider.supplies}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button type="button" className="provider-action-btn" onClick={onEdit} title="Editar">✏️</button>
          <button type="button" className="provider-action-btn provider-action-delete" onClick={onDelete} title="Eliminar">✕</button>
        </div>
      </div>

      <div className="provider-card-body">
        {provider.phone && (
          <div className="provider-detail">
            <span className="provider-detail-icon">📞</span>
            <a href={`tel:${provider.phone}`} className="provider-detail">{provider.phone}</a>
            <a
              href={`https://wa.me/${provider.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="provider-wa-btn"
              title="Abrir WhatsApp"
            >
              WhatsApp
            </a>
          </div>
        )}
        {provider.email && (
          <a href={`mailto:${provider.email}`} className="provider-detail">
            <span className="provider-detail-icon">✉️</span>
            <span>{provider.email}</span>
          </a>
        )}
        {provider.contactName && (
          <div className="provider-detail">
            <span className="provider-detail-icon">👤</span>
            <span>{provider.contactName}</span>
          </div>
        )}
        {provider.address && (
          <div className="provider-detail">
            <span className="provider-detail-icon">📍</span>
            <span>{provider.address}</span>
          </div>
        )}
        {materials.length > 0 && (
          <div className="provider-mat-tags">
            {materials.map((m) => (
              <span key={m.id} className="provider-mat-tag">{m.name}</span>
            ))}
          </div>
        )}
        {provider.notes && (
          <p className="provider-notes">{provider.notes}</p>
        )}
      </div>
    </div>
  )
}

export default function ProveedoresPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [supplies, setSupplies]   = useState<SupplyItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch]       = useState("")

  const load = useCallback(async () => {
    const [provs, sups] = await Promise.all([getProviders(), getSupplies()])
    setProviders(provs)
    setSupplies(sups)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Reconciliar el providerId de los materiales: asignar los tildados, limpiar los
  // que estaban vinculados a este proveedor y se destildaron.
  const reconcileSupplies = async (providerId: string, selectedIds: string[], previousIds: string[]) => {
    const selectedSet = new Set(selectedIds)
    const previousSet = new Set(previousIds)
    const ops: Promise<void>[] = []
    for (const id of selectedIds) {
      if (!previousSet.has(id)) ops.push(updateSupplyProvider(id, providerId))
    }
    for (const id of previousIds) {
      if (!selectedSet.has(id)) ops.push(updateSupplyProvider(id, null))
    }
    await Promise.all(ops)
  }

  const handleAdd = async (form: FormState, supplyIds: string[]) => {
    const pid = getActiveProjectId() ?? ""
    const created = await addProvider({ projectId: pid, ...form })
    await reconcileSupplies(created.id, supplyIds, [])
    await load()
    setShowForm(false)
  }

  const handleEdit = async (form: FormState, supplyIds: string[]) => {
    const p = providers.find((p) => p.id === editingId)!
    await updateProvider({ ...p, ...form })
    const previousIds = supplies.filter((s) => s.providerId === p.id).map((s) => s.id)
    await reconcileSupplies(p.id, supplyIds, previousIds)
    await load()
    setEditingId(null)
  }

  const handleDelete = async (p: Provider) => {
    if (!confirm(`¿Eliminar a "${p.name}"?`)) return
    // Desvincular sus materiales para no dejar referencias colgadas
    const linked = supplies.filter((s) => s.providerId === p.id).map((s) => s.id)
    await Promise.all(linked.map((id) => updateSupplyProvider(id, null)))
    await deleteProvider(p.id)
    await load()
  }

  const filtered = search.trim()
    ? providers.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.supplies?.toLowerCase().includes(search.toLowerCase()) ||
        p.contactName?.toLowerCase().includes(search.toLowerCase())
      )
    : providers

  const editingProvider = editingId ? providers.find((p) => p.id === editingId) : null
  const editingInitial  = editingProvider
    ? {
        name: editingProvider.name,
        phone: editingProvider.phone ?? "",
        email: editingProvider.email ?? "",
        contactName: editingProvider.contactName ?? "",
        supplies: editingProvider.supplies ?? "",
        address: editingProvider.address ?? "",
        notes: editingProvider.notes ?? "",
      }
    : undefined

  // Materiales por proveedor, y mapa de materiales asignados a OTRO proveedor (para el hint)
  const materialsByProvider = useMemo(() => {
    const map: Record<string, SupplyItem[]> = {}
    for (const s of supplies) {
      if (s.providerId) {
        if (!map[s.providerId]) map[s.providerId] = []
        map[s.providerId].push(s)
      }
    }
    return map
  }, [supplies])

  const assignedElsewhere = useMemo(() => {
    const map: Record<string, string> = {}
    const provName = (id: string) => providers.find((p) => p.id === id)?.name ?? ""
    for (const s of supplies) {
      if (s.providerId && s.providerId !== editingId) {
        const name = provName(s.providerId)
        if (name) map[s.id] = name
      }
    }
    return map
  }, [supplies, providers, editingId])

  const editingSupplyIds = editingProvider
    ? supplies.filter((s) => s.providerId === editingProvider.id).map((s) => s.id)
    : []

  return (
    <div className="page-wrap space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Contactos</p>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">
            {loading ? "Cargando..." : `${providers.length} proveedor${providers.length !== 1 ? "es" : ""} registrado${providers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {!showForm && !editingId && (
          <button type="button" className="proj-btn-primary" style={{ marginTop: "0.25rem", whiteSpace: "nowrap" }} onClick={() => setShowForm(true)}>
            + Nuevo proveedor
          </button>
        )}
      </div>

      {/* Formulario nuevo proveedor */}
      {showForm && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-4">Nuevo proveedor</h2>
          <ProviderForm
            supplies={supplies}
            initialSupplyIds={[]}
            assignedElsewhere={assignedElsewhere}
            onSave={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Formulario editar proveedor */}
      {editingId && editingInitial && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-4">Editar proveedor</h2>
          <ProviderForm
            initial={editingInitial}
            supplies={supplies}
            initialSupplyIds={editingSupplyIds}
            assignedElsewhere={assignedElsewhere}
            onSave={handleEdit}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {/* Buscador */}
      {providers.length > 0 && (
        <input
          type="search"
          className="proj-form-input"
          style={{ maxWidth: 340 }}
          placeholder="Buscar por nombre, qué provee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {/* Grilla de tarjetas */}
      {loading ? (
        <p className="text-sm text-stone-400">Cargando proveedores...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">{search ? "Sin resultados" : "Sin proveedores"}</p>
          <p className="empty-state-desc">{search ? "Probá con otro término" : "Agregá el primer proveedor con el botón de arriba"}</p>
        </div>
      ) : (
        <div className="provider-grid">
          {filtered.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              materials={materialsByProvider[p.id] ?? []}
              onEdit={() => { setEditingId(p.id); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }) }}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
