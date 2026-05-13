"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { MOCK_USERS, MOCK_DEMO_PASSWORD } from "@/lib/auth-client"
import { setMockSession } from "@/lib/auth-server"

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  architect: "Arquitecto",
  supervisor: "Encargado de Obra",
}

const ROLE_DESC: Record<string, string> = {
  owner: "Visualización completa del proyecto",
  architect: "Gestión total + importación de datos",
  supervisor: "Gestión de tareas y registro fotográfico",
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("encargado@obra.demo")
  const [password, setPassword] = useState(MOCK_DEMO_PASSWORD)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (password !== MOCK_DEMO_PASSWORD) {
        setError("Contraseña incorrecta. Usa: demo123")
        return
      }
      const user = MOCK_USERS[email]
      if (!user) {
        setError("Usuario no encontrado")
        return
      }
      const session = {
        user,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
      await setMockSession(session)
      router.push("/dashboard")
    } catch {
      setError("Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = MOCK_USERS[email]

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
          <div className="login-card-header">
            <p>Acceso al sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && <div className="login-error">{error}</div>}

            {/* Usuario */}
            <div>
              <label htmlFor="user-select" className="login-label">
                Usuario de demo
              </label>
              <select
                id="user-select"
                aria-label="Seleccionar usuario de demo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
              >
                {Object.entries(MOCK_USERS).map(([mail, user]) => (
                  <option key={mail} value={mail}>
                    {user.name} — {ROLE_LABEL[user.role]}
                  </option>
                ))}
              </select>
            </div>

            {/* Chip rol */}
            {selectedUser && (
              <div className="login-role-chip">
                <div className="login-role-avatar">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <p className="login-role-name">{ROLE_LABEL[selectedUser.role]}</p>
                  <p className="login-role-desc">{ROLE_DESC[selectedUser.role]}</p>
                </div>
              </div>
            )}

            {/* Contraseña */}
            <div>
              <label htmlFor="password-input" className="login-label">
                Contraseña
              </label>
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="demo123"
                className="login-input"
              />
              <p className="login-hint">
                Contraseña de demo: <strong>demo123</strong>
              </p>
            </div>

            <button type="submit" disabled={loading} className="login-btn">
              {loading ? "Ingresando..." : "Ingresar a la Obra"}
            </button>
          </form>
        </div>

        <p className="login-footer">Sistema de gestión de obras · MVP v1.0</p>
      </div>
    </div>
  )
}
