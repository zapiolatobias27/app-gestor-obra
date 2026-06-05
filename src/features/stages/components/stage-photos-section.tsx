"use client"

import React, { useEffect, useState } from "react"
import { Camera } from "lucide-react"
import { getStagePhotos, addPhoto, deletePhoto } from "@/lib/mock-db"
import { PhotoUpload } from "@/features/photos/components/photo-upload"
import type { Photo } from "@/types/project"

interface StagePhotosSectionProps {
  stageId: string
  currentUserId: string
}

export function StagePhotosSection({ stageId, currentUserId }: StagePhotosSectionProps) {
  const [photos, setPhotos]               = useState<Photo[]>([])
  const [showModal, setShowModal]         = useState(false)
  const [lightbox, setLightbox]           = useState<Photo | null>(null)

  useEffect(() => {
    getStagePhotos(stageId).then(setPhotos).catch(console.error)
  }, [stageId])

  const handleAdd = async (url: string, caption?: string) => {
    const photo = await addPhoto(url, caption ?? "", currentUserId, stageId)
    setPhotos((prev) => [photo, ...prev])
    setShowModal(false)
  }

  const handleDelete = async (photoId: string) => {
    await deletePhoto(photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    if (lightbox?.id === photoId) setLightbox(null)
  }

  return (
    <div className="card-obra p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-title">Fotos de la etapa ({photos.length})</p>
        <button
          type="button"
          className="proj-btn-ghost flex items-center gap-1.5"
          onClick={() => setShowModal((v) => !v)}
        >
          <Camera size={16} />
          Agregar foto
        </button>
      </div>

      {showModal && (
        <div className="space-y-2">
          <PhotoUpload onUpload={handleAdd} />
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="w-full text-sm text-stone-500 hover:text-stone-700 transition-colors py-1"
          >
            Cancelar
          </button>
        </div>
      )}

      {photos.length === 0 && !showModal ? (
        <p className="text-sm text-stone-400">Sin fotos registradas</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="photo-thumb-wrap">
              <button
                type="button"
                className="photo-thumb-btn"
                onClick={() => setLightbox(p)}
                aria-label={p.caption ?? "Ver foto"}
              >
                <img src={p.url} alt={p.caption ?? "Foto de etapa"} className="photo-thumb" />
              </button>
              <button
                type="button"
                className="photo-thumb-delete"
                onClick={() => handleDelete(p.id)}
                aria-label="Eliminar foto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="photo-lightbox" onClick={() => setLightbox(null)}>
          <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption ?? "Foto"} className="photo-lightbox-img" />
            {lightbox.caption && <p className="photo-lightbox-caption">{lightbox.caption}</p>}
            <p className="photo-lightbox-meta">
              {new Date(lightbox.uploadedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
              {" · "}{lightbox.uploadedBy}
            </p>
            <button type="button" className="photo-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
