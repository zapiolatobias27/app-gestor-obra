"use client"

import React, { useState } from "react"
import { forgotPassword } from "@/lib/auth-client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el email")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="w-full max-w-md">
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
          <p className="login-subtitle">Recuperar contraseña</p>
        </div>

        <div className="login-card">
          {sent ? (
            <div className="p-6 text-center space-y-4">
              <div className="text-5xl">✉️</div>
              <p className="text-[var(--stone-700)] font-medium">Revisá tu casilla de correo</p>
              <p className="text-[var(--sand-600)] text-sm">
                Si existe una cuenta con ese email, vas a recibir un link para restablecer tu contraseña.
              </p>
              <a
                href="/login"
                className="block text-sm text-[var(--clay-500)] hover:text-[var(--clay-700)] transition-colors pt-2"
              >
                Volver al inicio de sesión
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <p className="text-[var(--sand-600)] text-sm">
                Ingresá tu email y te enviamos un link para restablecer tu contraseña.
              </p>

              {error && <div className="login-error">{error}</div>}

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

              <button type="submit" disabled={loading} className="login-btn">
                {loading ? "Enviando..." : "Enviar link de recuperación"}
              </button>

              <div className="text-center">
                <a
                  href="/login"
                  className="text-sm text-[var(--clay-500)] hover:text-[var(--clay-700)] transition-colors"
                >
                  Volver al inicio de sesión
                </a>
              </div>
            </form>
          )}
        </div>

        <p className="login-footer">Sistema de gestión de obras · v2.0</p>
      </div>
    </div>
  )
}
