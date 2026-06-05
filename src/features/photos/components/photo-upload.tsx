"use client"

import React, { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getActiveProjectId } from "@/lib/projects-db"
import type { Stage, Task } from "@/types/project"

interface PhotoUploadProps {
  stages?: Stage[]
  tasks?: Task[]
  onUpload?: (photoUrl: string, caption?: string, stageId?: string, taskId?: string) => Promise<void>
}

export function PhotoUpload({ stages, tasks, onUpload }: PhotoUploadProps) {
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState("")
  const [caption, setCaption]     = useState("")
  const [stageId, setStageId]     = useState("")
  const [taskId, setTaskId]       = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const stageTasks = stageId && tasks ? tasks.filter((t) => t.stageId === stageId) : []

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStageId(e.target.value)
    setTaskId("")
  }

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

      await onUpload?.(publicUrl, caption || undefined, stageId || undefined, taskId || undefined)
      setFile(null)
      setPreview("")
      setCaption("")
      setStageId("")
      setTaskId("")
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

      {stages && stages.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Etapa (opcional)</label>
          <select
            value={stageId}
            onChange={handleStageChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Sin etapa</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} · ${s.name}` : s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {stageTasks.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Tarea (opcional)</label>
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Sin tarea</option>
            {stageTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}

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
