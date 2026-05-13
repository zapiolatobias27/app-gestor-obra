"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Session, User, UserRole } from "@/types/user"

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Propietario",
  architect: "Arquitecto",
  supervisor: "Encargado de Obra",
}

const SESSION_KEY = "obra:session"

export default function ProfilePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<User | null>(null)
  const [toast, setToast] = useState("")

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      router.push("/login")
      return
    }
    try {
      const session = JSON.parse(raw) as Session
      setUser(session.user)
    } catch {
      router.push("/login")
    }
  }, [router])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2200)
  }

  const updateField = <K extends keyof User>(key: K, value: User[K]) => {
    if (!user) return
    setUser({ ...user, [key]: value })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) {
      showToast("La imagen debe pesar menos de 2MB")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateField("avatarUrl", reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!user) return
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    try {
      const session = JSON.parse(raw) as Session
      session.user = user
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      showToast("Perfil guardado ✓")
      window.dispatchEvent(new Event("obra:session-updated"))
    } catch {
      showToast("No se pudo guardar")
    }
  }

  const handleLogout = () => {
    if (!confirm("¿Cerrar sesión?")) return
    localStorage.removeItem(SESSION_KEY)
    router.push("/login")
  }

  if (!user) {
    return <div className="p-8 text-stone-600">Cargando...</div>
  }

  const initial = (user.name || "?").charAt(0).toUpperCase()

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Mi perfil</h1>
          <p className="text-stone-600 mt-2">Editá tus datos personales y tu foto.</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-stone-800 text-white rounded hover:bg-stone-900 text-sm font-medium"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-clay-200 flex items-center justify-center overflow-hidden text-2xl font-semibold text-clay-700">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 border border-stone-300 rounded text-sm hover:bg-stone-50"
            >
              Cambiar foto
            </button>
            {user.avatarUrl && (
              <button
                onClick={() => updateField("avatarUrl", undefined)}
                className="px-3 py-1.5 text-sm text-stone-600 hover:text-red-600 ml-2"
              >
                Quitar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-stone-700">Nombre</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={user.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Email</span>
            <input
              type="email"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={user.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Teléfono</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={user.phone ?? ""}
              onChange={(e) => updateField("phone", e.target.value || undefined)}
              placeholder="+54 9 261 ..."
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Fecha de nacimiento</span>
            <input
              type="date"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={user.birthDate ?? ""}
              onChange={(e) => updateField("birthDate", e.target.value || undefined)}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-stone-700">Dirección</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={user.address ?? ""}
              onChange={(e) => updateField("address", e.target.value || undefined)}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-stone-700">Bio</span>
            <textarea
              className="mt-1 w-full border rounded px-2 py-1.5"
              rows={3}
              value={user.bio ?? ""}
              onChange={(e) => updateField("bio", e.target.value || undefined)}
              placeholder="Contanos algo sobre vos..."
            />
          </label>
          <div className="block text-sm md:col-span-2">
            <span className="text-stone-700">Rol</span>
            <p className="mt-1 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-stone-600">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-clay-500 text-white rounded hover:bg-clay-600 text-sm font-medium"
          >
            Guardar cambios
          </button>
          {toast && <span className="text-sm text-stone-600">{toast}</span>}
        </div>
      </div>
    </div>
  )
}
