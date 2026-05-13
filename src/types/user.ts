export type UserRole = "owner" | "architect" | "supervisor"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  phone?: string
  address?: string
  bio?: string
  birthDate?: string
}

export interface Session {
  user: User
  expiresAt: Date
}
