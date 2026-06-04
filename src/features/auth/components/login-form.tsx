"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp } from "@/lib/auth-client"

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
        await signUp(email, password, name)
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
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                  className="login-input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--sand-500)] hover:text-[var(--sand-700)] transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>


            {mode === "login" && (
              <div className="text-right -mt-2">
                <a href="/forgot-password" className="text-sm text-[var(--clay-500)] hover:text-[var(--clay-700)] transition-colors">
                  ¿Olvidaste tu contraseña?
                </a>
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
