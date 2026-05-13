"use client"

import React from "react"
import { PhotoGallery } from "@/features/photos/components/photo-gallery"
import { PhotoUpload } from "@/features/photos/components/photo-upload"

export default function PhotosPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Registro Fotográfico</h1>
        <p className="text-gray-600 mt-2">Galería de evidencia visual del avance de obra</p>
      </div>

      {/* Upload Form */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Subir Nueva Foto</h2>
        <PhotoUpload />
      </div>

      {/* Gallery */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Fotos de Obra</h2>
        <PhotoGallery photos={[]} />
      </div>
    </div>
  )
}
