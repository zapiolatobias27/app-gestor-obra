"use client"

import React, { useState } from "react"

interface PhotoUploadProps {
  onUpload?: (photoUrl: string, caption?: string) => void
}

export function PhotoUpload({ onUpload }: PhotoUploadProps) {
  const [caption, setCaption] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoUrl.trim()) return

    onUpload?.(photoUrl, caption || undefined)
    setCaption("")
    setPhotoUrl("")
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">URL de la Foto</label>
        <input
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://ejemplo.com/foto.jpg"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Descripción (opcional)</label>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Descripción breve de la foto..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Subir Foto
      </button>
    </form>
  )
}
