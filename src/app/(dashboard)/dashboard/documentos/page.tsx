"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { getDocuments, addDocument, deleteDocument } from "@/lib/mock-db"
import { getActiveProjectId } from "@/lib/projects-db"
import { createClient } from "@/lib/supabase/client"
import { loadPermissionsCache, canEdit } from "@/lib/permissions"
import type { ProjectDocument } from "@/types/project"

const CATEGORIES = ["Planos", "Permisos", "Contratos", "Presupuestos", "Otros"] as const
type Category = (typeof CATEGORIES)[number]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

function fileTypeFrom(file: File): ProjectDocument["fileType"] {
  if (file.type === "application/pdf") return "pdf"
  if (file.type.startsWith("image/")) return "image"
  return "other"
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPdf() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-red-500 shrink-0">
      <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" />
      <text x="5" y="13" fontSize="5" fontWeight="bold" fill="currentColor" fontFamily="sans-serif" opacity=".9">PDF</text>
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-blue-500 shrink-0">
      <rect x="2" y="3" width="16" height="14" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="7.5" r="1.5" fill="currentColor" opacity=".7" />
      <path d="M2 13l4.5-4 3.5 3.5 2.5-2.5L18 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".8" />
    </svg>
  )
}

function IconFile() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-stone-400 shrink-0">
      <rect x="3" y="1" width="11" height="15" rx="1.5" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" />
      <path d="M6 9h8M6 11.5h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".6" />
    </svg>
  )
}

function DocIcon({ fileType }: { fileType: ProjectDocument["fileType"] }) {
  if (fileType === "pdf")   return <IconPdf />
  if (fileType === "image") return <IconImage />
  return <IconFile />
}

// ─── Category group ───────────────────────────────────────────────────────────

function CategoryGroup({
  category, docs, canDel, onPreview, onDelete,
}: {
  category: string
  docs: ProjectDocument[]
  canDel: boolean
  onPreview: (doc: ProjectDocument) => void
  onDelete: (doc: ProjectDocument) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-2 text-left"
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
          className={`shrink-0 text-stone-400 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{category}</span>
        <span className="text-xs text-stone-400">({docs.length})</span>
      </button>

      {open && (
        <div className="space-y-1 mb-4">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-stone-100 rounded-xl hover:border-stone-200 transition-colors">
              <DocIcon fileType={doc.fileType} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{doc.name}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {fmtDate(doc.uploadedAt)} · {doc.uploadedBy}
                  {doc.notes && <span className="ml-1 text-stone-400">· {doc.notes}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className="proj-btn-ghost-sm"
                  onClick={() => onPreview(doc)}
                >
                  Ver
                </button>
                <a
                  href={doc.url}
                  download={doc.name}
                  className="proj-btn-ghost-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Descargar
                </a>
                {canDel && (
                  <button
                    type="button"
                    className="proj-btn-danger-sm"
                    onClick={() => onDelete(doc)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  category: Category
  notes: string
  file: File | null
  preview: string | null
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "Planos",
  notes: "",
  file: null,
  preview: null,
}

export default function DocumentosPage() {
  const perms    = loadPermissionsCache()
  const canDel   = canEdit(perms, "documentos")
  const canUpload = canEdit(perms, "documentos")

  const [docs, setDocs]         = useState<ProjectDocument[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState("")
  const [lightbox, setLightbox]   = useState<ProjectDocument | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getDocuments()
    setDocs(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    if (form.preview) URL.revokeObjectURL(form.preview)
    setForm(EMPTY_FORM)
    setFormError("")
    setShowForm(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "")
    setForm((f) => ({
      ...f,
      file,
      preview,
      name: f.name || nameWithoutExt,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.file) { setFormError("Seleccioná un archivo."); return }
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }

    setUploading(true)
    setFormError("")
    try {
      const supabase = createClient()
      const pid = getActiveProjectId()
      const ext = form.file.name.split(".").pop() ?? "bin"
      const path = `${pid}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, form.file, { contentType: form.file.type })
      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path)

      const { data: { user } } = await supabase.auth.getUser()
      let uploadedBy = "Usuario"
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
        uploadedBy = (profile?.name as string) || user.email || "Usuario"
      }

      await addDocument({
        name:       form.name.trim(),
        url:        publicUrl,
        fileType:   fileTypeFrom(form.file),
        category:   form.category,
        uploadedBy,
        notes:      form.notes.trim() || undefined,
      })

      resetForm()
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al subir el archivo")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: ProjectDocument) => {
    if (!confirm(`¿Eliminar "${doc.name}"?`)) return
    await deleteDocument(doc.id)
    setDocs((prev) => prev.filter((d) => d.id !== doc.id))
  }

  // Group by category, preserving defined order
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    docs: docs.filter((d) => d.category === cat),
  })).filter((g) => g.docs.length > 0)

  const uncategorized = docs.filter((d) => !CATEGORIES.includes(d.category as Category))

  return (
    <>
      <div className="page-wrap space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="page-eyebrow">Registro</p>
            <h1 className="page-title">Documentación</h1>
            <p className="page-subtitle">Planos, permisos y documentación de la obra.</p>
          </div>
          {canUpload && !showForm && (
            <button type="button" className="proj-btn-primary" onClick={() => setShowForm(true)}>
              + Cargar documento
            </button>
          )}
        </div>

        {/* Upload form */}
        {showForm && (
          <div className="card-obra p-5 space-y-4">
            <h3 className="font-semibold text-stone-800">Nuevo documento</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File picker */}
              {!form.file ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-stone-200 rounded-xl py-10 cursor-pointer hover:border-stone-300 hover:bg-stone-50 transition-colors"
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-stone-300" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-medium text-stone-600">Arrastrá o hacé click para seleccionar</p>
                    <p className="text-xs text-stone-400 mt-0.5">PDF o imagen</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 border border-stone-200 rounded-lg px-3 py-2.5 bg-stone-50">
                  <DocIcon fileType={fileTypeFrom(form.file)} />
                  <span className="flex-1 text-sm text-stone-700 truncate">{form.file.name}</span>
                  <button
                    type="button"
                    className="proj-btn-ghost-sm shrink-0"
                    onClick={() => {
                      if (form.preview) URL.revokeObjectURL(form.preview)
                      setForm((f) => ({ ...f, file: null, preview: null, name: "" }))
                      if (fileRef.current) fileRef.current.value = ""
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    className="proj-form-input w-full"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Plano planta baja Rev.3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Categoría</label>
                  <select
                    className="proj-form-input w-full"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">Notas <span className="text-stone-400 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    className="proj-form-input w-full"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Ej: Versión aprobada por municipio"
                  />
                </div>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-2">
                <button type="submit" className="proj-btn-primary" disabled={uploading}>
                  {uploading ? "Subiendo…" : "Guardar documento"}
                </button>
                <button type="button" className="proj-btn-ghost" onClick={resetForm} disabled={uploading}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Document list */}
        {loading ? (
          <p className="text-sm text-stone-400 py-8 text-center">Cargando…</p>
        ) : docs.length === 0 ? (
          <div className="card-obra p-10 flex flex-col items-center gap-3 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-stone-300" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm text-stone-400">No hay documentos cargados todavía.</p>
            {canUpload && (
              <button type="button" className="proj-btn-primary" onClick={() => setShowForm(true)}>
                + Cargar primer documento
              </button>
            )}
          </div>
        ) : (
          <div className="card-obra p-5 space-y-1">
            {grouped.map(({ category, docs: catDocs }) => (
              <CategoryGroup
                key={category}
                category={category}
                docs={catDocs}
                canDel={canDel}
                onPreview={setLightbox}
                onDelete={handleDelete}
              />
            ))}
            {uncategorized.length > 0 && (
              <CategoryGroup
                category="Sin categoría"
                docs={uncategorized}
                canDel={canDel}
                onPreview={setLightbox}
                onDelete={handleDelete}
              />
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="photo-lightbox" onClick={() => setLightbox(null)}>
          {lightbox.fileType === "pdf" ? (
            <div className="pdf-lightbox-inner" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="photo-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
              <iframe src={lightbox.url} className="pdf-lightbox-frame" title={lightbox.name} />
            </div>
          ) : (
            <>
              <button type="button" className="photo-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
              <img
                src={lightbox.url}
                alt={lightbox.name}
                className="photo-lightbox-img"
                onClick={(e) => e.stopPropagation()}
              />
            </>
          )}
        </div>
      )}
    </>
  )
}
