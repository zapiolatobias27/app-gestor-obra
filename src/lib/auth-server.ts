import { Session } from "@/types/user"

const SESSION_COOKIE = "obra:session"

/**
 * Lee la sesión activa desde localStorage.
 * @internal No se usa directamente en componentes — la sesión se lee vía useSession hook.
 */
export async function getMockSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null

  const sessionData = localStorage.getItem(SESSION_COOKIE)
  if (!sessionData) return null

  try {
    const parsed = JSON.parse(sessionData) as Session
    // Restaurar Date desde string (JSON.parse no hidrata fechas)
    parsed.expiresAt = new Date(parsed.expiresAt)
    return parsed
  } catch {
    return null
  }
}

/** Persiste la sesión en localStorage. */
export async function setMockSession(session: Session): Promise<void> {
  if (typeof window === "undefined") return
  localStorage.setItem(SESSION_COOKIE, JSON.stringify(session))
}

/**
 * Elimina la sesión activa.
 * @internal Llamar desde el flujo de logout del componente correspondiente.
 */
export async function clearMockSession(): Promise<void> {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_COOKIE)
}

