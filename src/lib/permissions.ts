import type { MemberPermissions, UserRole } from "@/types/project"

// ─── Permission tree (used in modal + defaults) ───────────────────────────────

type PermLeaf = { key: string; label: string; hasEdit: boolean }
type PermGroup = { label: string; subsections: PermLeaf[] }
export type PermTreeNode = PermLeaf | PermGroup

export function isGroup(node: PermTreeNode): node is PermGroup {
  return "subsections" in node
}

export const PERM_TREE: PermTreeNode[] = [
  { key: "dashboard",   label: "Dashboard",          hasEdit: false },
  { key: "stages",      label: "Etapas",             hasEdit: true },
  { key: "stock",       label: "Stock",              hasEdit: true },
  { key: "calendario",  label: "Calendario",         hasEdit: true },
  { key: "proveedores", label: "Proveedores",        hasEdit: true },
  { label: "Tickets", subsections: [
    { key: "invoices.facturas", label: "Tickets", hasEdit: true },
    { key: "invoices.remitos",  label: "Remitos",  hasEdit: true },
  ]},
  { label: "Compras y Materiales", subsections: [
    { key: "compras.solicitudes", label: "Solicitudes", hasEdit: true },
    { key: "compras.materiales",  label: "Materiales",  hasEdit: true },
  ]},
  { label: "Caja", subsections: [
    { key: "caja.grande", label: "Caja Grande", hasEdit: true },
    { key: "caja.chica",  label: "Caja Chica",  hasEdit: true },
  ]},
  { key: "documentos", label: "Documentos", hasEdit: true },
  { key: "fotos",      label: "Fotos",      hasEdit: true },
  { key: "import",     label: "Importar",   hasEdit: true },
]

// All leaf keys, derived from the tree
export const ALL_PERM_KEYS: string[] = PERM_TREE.flatMap((node) =>
  isGroup(node) ? node.subsections.map((s) => s.key) : [node.key],
)

// ─── Sidebar href → permission keys ──────────────────────────────────────────

export const HREF_TO_PERM_KEYS: Record<string, string[]> = {
  "/dashboard":             ["dashboard"],
  "/dashboard/stages":      ["stages"],
  "/dashboard/stock":       ["stock"],
  "/dashboard/calendario":  ["calendario"],
  "/dashboard/proveedores": ["proveedores"],
  "/dashboard/invoices":    ["invoices.facturas", "invoices.remitos"],
  "/dashboard/compras":     ["compras.solicitudes", "compras.materiales"],
  "/dashboard/caja":        ["caja.grande", "caja.chica"],
  "/dashboard/documentos":  ["documentos"],
  "/dashboard/photos":      ["fotos"],
  "/dashboard/import":      ["import"],
}

// ─── Default permissions by role ─────────────────────────────────────────────

export function defaultPermissions(role: UserRole): MemberPermissions {
  const all = Object.fromEntries(
    ALL_PERM_KEYS.map((k) => [k, { view: true, edit: true }]),
  ) as MemberPermissions
  if (role === "supervisor") {
    // Supervisor: no accede a Caja Grande ni a Importar por defecto
    all["caja.grande"] = { view: false, edit: false }
    all["import"]      = { view: false, edit: false }
  }
  return all
}

// ─── Permission check helpers ─────────────────────────────────────────────────

export function canView(perms: MemberPermissions | null | undefined, key: string): boolean {
  if (!perms) return true
  return perms[key]?.view !== false
}

export function canEdit(perms: MemberPermissions | null | undefined, key: string): boolean {
  if (!perms) return true
  if (perms[key]?.view === false) return false
  return perms[key]?.edit !== false
}

// Section visible if ANY of its keys has view !== false
export function sectionVisible(perms: MemberPermissions | null | undefined, ...keys: string[]): boolean {
  if (!perms) return true
  return keys.some((k) => canView(perms, k))
}

// ─── localStorage cache ───────────────────────────────────────────────────────

const CACHE_KEY = "obra:member-permissions"

export function savePermissionsCache(perms: MemberPermissions | null): void {
  if (typeof window === "undefined") return
  if (perms === null) {
    localStorage.removeItem(CACHE_KEY)
  } else {
    localStorage.setItem(CACHE_KEY, JSON.stringify(perms))
  }
}

export function loadPermissionsCache(): MemberPermissions | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return null // old format
    return parsed as MemberPermissions
  } catch {
    return null
  }
}
