"use client"

import React, { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface ProfileForm {
  name: string
  phone: string
  address: string
  bio: string
  birthDate: string
}

export default function ProfilePage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<ProfileForm>({
    name: "", phone: "", address: "", bio: "", birthDate: "",
  })
  const [email, setEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>()
  const [toast, setToast] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? "")
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      if (profile) {
        setForm({
          name:      profile.name ?? "",
          phone:     profile.phone ?? "",
          address:   profile.address ?? "",
          bio:       profile.bio ?? "",
          birthDate: profile.birth_date ?? "",
        })
        setAvatarUrl(profile.avatar_url ?? undefined)
      }
      setLoading(false)
    }
    load()
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2200)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast("La imagen debe pesar menos de 2MB")
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from("profiles").update({
      name:       form.name,
      phone:      form.phone || null,
      address:    form.address || null,
      bio:        form.bio || null,
      birth_date: form.birthDate || null,
      avatar_url: avatarUrl || null,
    }).eq("id", user.id)
    if (error) showToast("Error al guardar")
    else showToast("Perfil guardado ✓")
  }

  if (loading) return <div className="p-8 text-stone-600">Cargando...</div>

  const initial = (form.name || email || "?").charAt(0).toUpperCase()

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">Mi perfil</h1>
        <p className="text-stone-600 mt-2">Editá tus datos personales y tu foto.</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-clay-200 flex items-center justify-center overflow-hidden text-2xl font-semibold text-clay-700">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 border border-stone-300 rounded text-sm hover:bg-stone-50"
            >
              Cambiar foto
            </button>
            {avatarUrl && (
              <button
                onClick={() => setAvatarUrl(undefined)}
                className="px-3 py-1.5 text-sm text-stone-600 hover:text-red-600 ml-2"
              >
                Quitar
              </button>
            )}
          </div>
        </div>

        {/* Campos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-stone-700">Nombre</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Email</span>
            <input
              type="email"
              className="mt-1 w-full border rounded px-2 py-1.5 bg-stone-50 text-stone-500"
              value={email}
              readOnly
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Teléfono</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+54 9 261 ..."
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-700">Fecha de nacimiento</span>
            <input
              type="date"
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-stone-700">Dirección</span>
            <input
              className="mt-1 w-full border rounded px-2 py-1.5"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-stone-700">Bio</span>
            <textarea
              className="mt-1 w-full border rounded px-2 py-1.5"
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Contanos algo sobre vos..."
            />
          </label>
          <div className="block text-sm md:col-span-2">
            <span className="text-stone-700">Rol</span>
            <p className="mt-1 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-stone-500 text-xs">
              Tu rol depende del proyecto activo. Podés verlo en la sección Proyectos.
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
