"use client"

import React, { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getActiveProjectId } from "@/lib/projects-db"

interface PhotoUploadProps {
  onUpload?: (photoUrl: string, caption?: string) => void
}

export function PhotoUpload({ onUpload }: PhotoUploadProps) {
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState("")
  const [caption, setCaption]     = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError("")
    try {
      const supabase = createClient()
      const pid = getActiveProjectId() ?? "unknown"
      const ext = file.name.split(".").pop() ?? "jpg"
      const path = `${pid}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from("photos")
        .getPublicUrl(path)

      onUpload?.(publicUrl, caption || undefined)
      setFile(null)
      setPreview("")
      setCaption("")
      if (inputRef.current) inputRef.current.value = ""
    } catch {
      setError("No se pudo subir la foto. Intentá de nuevo.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Foto</label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer"
          required
        />
        {preview && (
          <img
            src={preview}
            alt="Vista previa"
            className="mt-2 rounded-lg object-cover"
            style={{ width: 120, height: 120 }}
          />
        )}
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {uploading ? "Subiendo..." : "Subir Foto"}
      </button>
    </form>
  )
}
