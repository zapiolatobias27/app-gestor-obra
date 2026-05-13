"use client"

import { User, Session, UserRole } from "@/types/user"

export const MOCK_DEMO_PASSWORD = "demo123"

export const MOCK_USERS: Record<string, User> = {
  "propietario@obra.demo": {
    id: "1",
    name: "Juan Propietario",
    email: "propietario@obra.demo",
    role: "owner",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=owner",
  },
  "arquitecto@obra.demo": {
    id: "2",
    name: "María Arquitecta",
    email: "arquitecto@obra.demo",
    role: "architect",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=architect",
  },
  "encargado@obra.demo": {
    id: "3",
    name: "Carlos Encargado",
    email: "encargado@obra.demo",
    role: "supervisor",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=supervisor",
  },
}

/**
 * Devuelve una sesión demo para el rol indicado.
 * @internal Útil para testing y storybook; en la app el login real usa MOCK_USERS directamente.
 */
export function getMockSessionForRole(role: UserRole): Session {
  const user = Object.values(MOCK_USERS).find((u) => u.role === role)
    ?? MOCK_USERS["encargado@obra.demo"]
  return {
    user,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }
}
