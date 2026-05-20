"use client"

import React, { useEffect, useState } from "react"
import { getProjectPhotos, getStages, addPhoto } from "@/lib/mock-db"
import { PhotoUpload } from "@/features/photos/components/photo-upload"
import { createClient } from "@/lib/supabase/client"
import type { Photo, Stage } from "@/types/project"

function PhotoAlbum({ title, code, photos, onPhotoClick }: {
  title: string
  code?: string
  photos: Photo[]
  onPhotoClick: (p: Photo) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="photo-album">
      <button type="button" className="photo-album-header" onClick={() => setOpen((v) => !v)}>
        <div className="photo-album-title">
          {code && <span className="photo-album-code">{code}</span>}
          <span>{title}</span>
        </div>
        <span className="photo-album-count">{photos.length} foto{photos.length !== 1 ? "s" : ""}</span>
        <span className="photo-album-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="photo-album-grid">
          {photos.map((p) => (
            <button key={p.id} type="button" className="photo-album-item" onClick={() => onPhotoClick(p)}>
              <img src={p.url} alt={p.caption ?? "Foto de obra"} className="photo-album-img" />
              {p.caption && <p className="photo-album-caption">{p.caption}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddPhotoModal({ onClose, onAdded }: {
  onClose: () => void
  onAdded: (photo: Photo) => void
}) {
  const [userName, setUserName] = useState("usuario")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single()
      if (data?.name) setUserName(data.name as string)
    })
  }, [])

  const handleUpload = async (url: string, caption?: string) => {
    const photo = await addPhoto(url, caption ?? "", userName)
    onAdded(photo)
    onClose()
  }

  return (
    <div className="photos-modal-overlay" onClick={onClose}>
      <div className="photos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="photos-modal-header">
          <h2 className="photos-modal-title">Agregar foto</h2>
          <button type="button" className="photos-modal-close" onClick={onClose}>✕</button>
        </div>
        <PhotoUpload onUpload={handleUpload} />
      </div>
    </div>
  )
}

function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.caption ?? "Foto"} className="photo-lightbox-img" />
        {photo.caption && <p className="photo-lightbox-caption">{photo.caption}</p>}
        <p className="photo-lightbox-meta">
          {new Date(photo.uploadedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
          {" · "}{photo.uploadedBy}
        </p>
        <button type="button" className="photo-lightbox-close" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}

export default function PhotosPage() {
  const [photos, setPhotos]       = useState<Photo[]>([])
  const [stages, setStages]       = useState<Stage[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [lightbox, setLightbox]   = useState<Photo | null>(null)

  useEffect(() => {
    Promise.all([getProjectPhotos(), getStages()]).then(([p, s]) => {
      setPhotos(p)
      setStages(s)
      setLoading(false)
    })
  }, [])

  const handleAdded = (photo: Photo) => setPhotos((prev) => [photo, ...prev])

  const stageAlbums = stages
    .map((s) => ({ stage: s, photos: photos.filter((p) => p.stageId === s.id) }))
    .filter(({ photos: sp }) => sp.length > 0)

  const generalPhotos = photos.filter((p) => !p.stageId)

  const totalAlbums = stageAlbums.length + (generalPhotos.length > 0 ? 1 : 0)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Registro</p>
          <h1 className="page-title">Fotos de obra</h1>
          <p className="page-subtitle">
            {loading
              ? "Cargando..."
              : `${photos.length} foto${photos.length !== 1 ? "s" : ""} · ${totalAlbums} álbum${totalAlbums !== 1 ? "es" : ""}`}
          </p>
        </div>
        <button
          type="button"
          className="proj-btn-primary"
          style={{ marginTop: "0.25rem", whiteSpace: "nowrap" }}
          onClick={() => setShowModal(true)}
        >
          + Agregar foto
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-400">Cargando fotos...</p>
      ) : photos.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">Sin fotos registradas</p>
          <p className="empty-state-desc">Agregá la primera foto con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-4">
          {generalPhotos.length > 0 && (
            <PhotoAlbum
              title="Sin etapa"
              photos={generalPhotos}
              onPhotoClick={setLightbox}
            />
          )}
          {stageAlbums.map(({ stage, photos: sp }) => (
            <PhotoAlbum
              key={stage.id}
              title={stage.name}
              code={stage.code}
              photos={sp}
              onPhotoClick={setLightbox}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddPhotoModal onClose={() => setShowModal(false)} onAdded={handleAdded} />
      )}

      {lightbox && (
        <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
