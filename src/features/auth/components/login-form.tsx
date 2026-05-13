"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp } from "@/lib/auth-client"
import type { UserRole } from "@/types/user"

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Propietario",
  architect: "Arquitecto",
  supervisor: "Encargado de Obra",
}

const ROLE_DESC: Record<UserRole, string> = {
  owner: "Visualización completa del proyecto",
  architect: "Gestión total + importación de datos",
  supervisor: "Gestión de tareas y registro fotográfico",
}

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<UserRole>("supervisor")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === "login") {
        await signIn(email, password)
      } else {
        if (!name.trim()) { setError("Ingresá tu nombre"); return }
        await signUp(email, password, name, role)
      }
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="text-center mb-8">
          <div className="login-icon-wrap mx-auto">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="4" y="20" width="24" height="4" rx="1" fill="var(--sand-300)" />
              <rect x="8" y="10" width="16" height="12" rx="1" fill="var(--sand-200)" />
              <path d="M6 10 L16 4 L26 10" stroke="var(--clay-400)" strokeWidth="2" fill="none" strokeLinejoin="round" />
              <rect x="13" y="14" width="6" height="8" rx="1" fill="var(--clay-500)" />
            </svg>
          </div>
          <h1 className="login-title">Obra Manager</h1>
          <p className="login-subtitle">Control digital de construcción</p>
        </div>

        {/* Card */}
        <div className="login-card">
          {/* Tabs */}
          <div className="flex border-b border-[var(--sand-200)]">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null) }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === "login" ? "text-[var(--clay-600)] border-b-2 border-[var(--clay-500)]" : "text-[var(--sand-500)] hover:text-[var(--sand-700)]"}`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null) }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === "register" ? "text-[var(--clay-600)] border-b-2 border-[var(--clay-500)]" : "text-[var(--sand-500)] hover:text-[var(--sand-700)]"}`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && <div className="login-error">{error}</div>}

            {/* Nombre (solo registro) */}
            {mode === "register" && (
              <div>
                <label htmlFor="name-input" className="login-label">Nombre completo</label>
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan García"
                  className="login-input"
                  required
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email-input" className="login-label">Email</label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="login-input"
                required
              />
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password-input" className="login-label">Contraseña</label>
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                className="login-input"
                required
              />
            </div>

            {/* Rol (solo registro) */}
            {mode === "register" && (
              <div>
                <label htmlFor="role-select" className="login-label">Rol en la obra</label>
                <select
                  id="role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="login-input"
                >
                  {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
                <p className="login-hint">{ROLE_DESC[role]}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="login-btn">
              {loading
                ? "Procesando..."
                : mode === "login" ? "Ingresar a la Obra" : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="login-footer">Sistema de gestión de obras · v2.0</p>
      </div>
    </div>
  )
}
