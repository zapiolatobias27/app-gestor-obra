"use client"

import React, { useCallback, useEffect, useState } from "react"
import { getProviders, addProvider, updateProvider, deleteProvider } from "@/lib/mock-db"
import { getActiveProjectId } from "@/lib/projects-db"
import type { Provider } from "@/types/project"

const EMPTY_FORM = {
  name: "", phone: "", email: "", contactName: "", supplies: "", address: "", notes: "",
}

type FormState = typeof EMPTY_FORM

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: FormState
  onSave: (f: FormState) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm]       = useState<FormState>(initial ?? EMPTY_FORM)
  const [error, setError]     = useState("")
  const [saving, setSaving]   = useState(false)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("El nombre del proveedor es obligatorio."); return }
    setSaving(true)
    setError("")
    try { await onSave(form) } catch { setError("Error al guardar. Intentá de nuevo.") }
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
  onEdit,
  onDelete,
}: {
  provider: Provider
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
        {provider.notes && (
          <p className="provider-notes">{provider.notes}</p>
        )}
      </div>
    </div>
  )
}

export default function ProveedoresPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch]       = useState("")

  const load = useCallback(async () => {
    const data = await getProviders()
    setProviders(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async (form: FormState) => {
    const pid = getActiveProjectId() ?? ""
    await addProvider({ projectId: pid, ...form })
    await load()
    setShowForm(false)
  }

  const handleEdit = async (form: FormState) => {
    const p = providers.find((p) => p.id === editingId)!
    await updateProvider({ ...p, ...form })
    await load()
    setEditingId(null)
  }

  const handleDelete = async (p: Provider) => {
    if (!confirm(`¿Eliminar a "${p.name}"?`)) return
    await deleteProvider(p.id)
    setProviders((prev) => prev.filter((x) => x.id !== p.id))
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
          <ProviderForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Formulario editar proveedor */}
      {editingId && editingInitial && (
        <div className="card-obra p-5">
          <h2 className="section-title mb-4">Editar proveedor</h2>
          <ProviderForm initial={editingInitial} onSave={handleEdit} onCancel={() => setEditingId(null)} />
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
              onEdit={() => { setEditingId(p.id); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }) }}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
