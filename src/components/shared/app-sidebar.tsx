"use client"

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { UserRole } from "@/types/user"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/lib/auth-client"
import { getActiveProjectId } from "@/lib/projects-db"

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Propietario",
  architect: "Arquitecto",
  supervisor: "Encargado de Obra",
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  section?: string
}

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2L14 5.5L8 9L2 5.5L8 2Z" fill="currentColor" opacity=".6" />
      <path d="M2 8.5L8 12L14 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function IconPackage() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="12" height="9" rx="1.5" fill="currentColor" opacity=".5" />
      <path d="M5 5V3.5A1.5 1.5 0 0 1 11 3.5V5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5.5 9H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconTruck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="5" width="9" height="7" rx="1" fill="currentColor" opacity=".5" />
      <path d="M10 7H13L15 10V12H10V7Z" fill="currentColor" opacity=".8" />
      <circle cx="4" cy="12.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

function IconReceipt() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="1.5" width="12" height="11" rx="1" fill="currentColor" opacity=".4" />
      <path d="M2 12.5L3.5 11L5 12.5L6.5 11L8 12.5L9.5 11L11 12.5L12.5 11L14 12.5V13.5H2V12.5Z" fill="currentColor" opacity=".7" />
      <path d="M5 5H11M5 7.5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="currentColor" opacity=".4" />
      <circle cx="5.5" cy="6" r="1.5" fill="currentColor" opacity=".8" />
      <path d="M1.5 10.5L5 7.5L8 10L11 8L14.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 10V3M5 6L8 3L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11V13.5H14V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="currentColor" opacity=".4" />
      <path d="M1.5 6H14.5M1.5 10H14.5M5.5 2.5V13.5M10 2.5V13.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="11" rx="1.5" fill="currentColor" opacity=".4" />
      <path d="M1.5 7H14.5" stroke="currentColor" strokeWidth="1" />
      <rect x="5" y="1" width="1.5" height="4" rx="0.75" fill="currentColor" />
      <rect x="9.5" y="1" width="1.5" height="4" rx="0.75" fill="currentColor" />
      <rect x="4" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity=".7" />
      <rect x="7" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity=".7" />
      <rect x="10" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity=".7" />
    </svg>
  )
}

export function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="14" height="1.75" rx="0.875" fill="currentColor" />
      <rect x="3" y="9.125" width="14" height="1.75" rx="0.875" fill="currentColor" />
      <rect x="3" y="13.25" width="14" height="1.75" rx="0.875" fill="currentColor" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Items de navegación comunes a todos los roles con acceso completo (owner + architect). */
const FULL_ACCESS_NAV: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard",            icon: <IconDashboard />, section: "General" },
  { label: "Etapas",     href: "/dashboard/stages",     icon: <IconLayers />,   section: "Obra" },
  { label: "Stock",      href: "/dashboard/stock",      icon: <IconPackage />,  section: "Obra" },
  { label: "Logística",  href: "/dashboard/logistics",  icon: <IconTruck />,    section: "Obra" },
  { label: "Facturas",   href: "/dashboard/invoices",   icon: <IconReceipt />,  section: "Obra" },
  { label: "Calendario", href: "/dashboard/calendario", icon: <IconCalendar />, section: "Obra" },
  { label: "Fotos",      href: "/dashboard/photos",     icon: <IconImage />,    section: "Registro" },
  { label: "Importar",   href: "/dashboard/import",     icon: <IconUpload />,   section: "Admin" },
]

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  owner:      FULL_ACCESS_NAV,
  architect:  FULL_ACCESS_NAV,
  supervisor: [
    { label: "Dashboard",  href: "/dashboard",            icon: <IconDashboard />, section: "General" },
    { label: "Etapas",     href: "/dashboard/stages",     icon: <IconLayers />,   section: "Obra" },
    { label: "Logística",  href: "/dashboard/logistics",  icon: <IconTruck />,    section: "Obra" },
    { label: "Calendario", href: "/dashboard/calendario", icon: <IconCalendar />, section: "Obra" },
    { label: "Fotos",      href: "/dashboard/photos",     icon: <IconImage />,    section: "Registro" },
  ],
}

interface AppSidebarProps {
  open: boolean
  onClose: () => void
  onToggle: () => void
}

export function AppSidebar({ open, onClose, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole]         = useState<UserRole>("supervisor")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? "")
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
      if (profile) setUserName(profile.name ?? "")
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const pid = getActiveProjectId()
      if (!pid) return
      const { data: member } = await supabase
        .from("project_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("project_id", pid)
        .single()
      setRole((member?.role as UserRole) ?? "supervisor")
    })
  }, [pathname])

  // Close sidebar on route change (mobile)
  useEffect(() => { onClose() }, [pathname, onClose])

  // Close user menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
    router.refresh()
  }

  const navItems = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.supervisor

  const sections = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const key = item.section ?? ""
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <>
      {/* Overlay oscuro en mobile cuando está abierto */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={cn("sidebar", open ? "sidebar-open" : "sidebar-closed")}>
        {/* Brand + botón hamburguesa */}
        <div className="sidebar-brand">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2" y="13" width="16" height="3" rx="1" fill="var(--sand-400)" />
                <rect x="5" y="7" width="10" height="7" rx="1" fill="var(--sand-300)" />
                <path d="M3 7L10 3L17 7" stroke="var(--clay-400)" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                <rect x="8" y="10" width="4" height="5" rx="0.75" fill="var(--clay-500)" />
              </svg>
              <span className="sidebar-brand-title">Obra Manager</span>
            </div>

            {/* Botón hamburguesa / cerrar */}
            <button
              type="button"
              onClick={onToggle}
              className="sidebar-menu-btn"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
            >
              {open ? <IconClose /> : <IconMenu />}
            </button>
          </div>
          <p className="sidebar-brand-sub">Control de construcción</p>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              {section && <p className="sidebar-section-label">{section}</p>}
              {items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn("sidebar-link", isActive && "sidebar-link-active")}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer usuario */}
        <div className="sidebar-footer" ref={menuRef}>
          {/* Menú desplegable (aparece arriba) */}
          {menuOpen && (
            <div className="sidebar-user-menu">
              <div className="sidebar-user-menu-header">
                <p className="sidebar-user-menu-name">{userName || "Usuario"}</p>
                {userEmail && <p className="sidebar-user-menu-email">{userEmail}</p>}
                <p className="sidebar-user-menu-role">{ROLE_LABEL[role]}</p>
              </div>
              <div className="sidebar-user-menu-divider" />
              <Link
                href="/dashboard/profile"
                className="sidebar-user-menu-item"
                onClick={() => setMenuOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="7" cy="4.5" r="2.5" fill="currentColor" opacity=".8" />
                  <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
                Perfil
              </Link>
              <Link
                href="/dashboard/projects"
                className="sidebar-user-menu-item"
                onClick={() => setMenuOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="3" width="12" height="2.5" rx="1" fill="currentColor" opacity=".7" />
                  <rect x="1" y="7" width="8" height="2.5" rx="1" fill="currentColor" opacity=".5" />
                  <rect x="1" y="11" width="5" height="2" rx="1" fill="currentColor" opacity=".3" />
                  <circle cx="11.5" cy="11" r="2" fill="currentColor" opacity=".9" />
                  <path d="M11.5 10v2M10.5 11h2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Gestión de proyectos
              </Link>
              <div className="sidebar-user-menu-divider" />
              <button
                type="button"
                className="sidebar-user-menu-item sidebar-user-menu-logout"
                onClick={handleLogout}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                  <path d="M9 10l3-3-3-3M12 7H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          )}

          <button
            type="button"
            className="sidebar-user-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen ? "true" : "false"}
            aria-label="Opciones de usuario"
          >
            <div className="sidebar-user-avatar">
              {userName.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="sidebar-user-name">{userName || "Usuario"}</p>
              <p className="sidebar-user-role">{ROLE_LABEL[role]}</p>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              aria-hidden="true"
              className={cn("sidebar-user-chevron", menuOpen && "sidebar-user-chevron-up")}
            >
              <path d="M3 9L7 5L11 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
