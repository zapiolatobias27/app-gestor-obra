"use client"

import React from "react"
import { Photo } from "@/types/project"
import { EmptyState } from "@/components/shared/empty-state"

interface PhotoGalleryProps {
  photos: Photo[]
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return <EmptyState title="Sin fotos" description="No hay fotos registradas en esta obra" />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative bg-white rounded-lg overflow-hidden border border-gray-200">
          <div className="aspect-square bg-gray-100 overflow-hidden">
            <img
              src={photo.url}
              alt={photo.caption || "Foto de obra"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          {photo.caption && (
            <div className="p-3 bg-white border-t border-gray-200">
              <p className="text-sm font-medium text-gray-900">{photo.caption}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(photo.uploadedAt).toLocaleDateString("es-AR")}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
