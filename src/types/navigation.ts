export interface NavItem {
  label: string
  href: string
  icon?: string
}

// Keyed by UserRole — use the index signature only as a fallback for dynamic access
export type NavConfig = Record<string, NavItem[]>
