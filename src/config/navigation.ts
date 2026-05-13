import { NavConfig } from "@/types/navigation"

export const NAVIGATION_CONFIG: NavConfig = {
  owner: [
    { label: "Dashboard",  href: "/dashboard",           icon: "LayoutDashboard" },
    { label: "Etapas",     href: "/dashboard/stages",    icon: "Layers" },
    { label: "Stock",      href: "/dashboard/stock",     icon: "Package" },
    { label: "Logística",  href: "/dashboard/logistics", icon: "Truck" },
    { label: "Fotos",      href: "/dashboard/photos",    icon: "Image" },
    { label: "Importar",   href: "/dashboard/import",    icon: "Upload" },
  ],
  architect: [
    { label: "Dashboard",  href: "/dashboard",           icon: "LayoutDashboard" },
    { label: "Etapas",     href: "/dashboard/stages",    icon: "Layers" },
    { label: "Stock",      href: "/dashboard/stock",     icon: "Package" },
    { label: "Logística",  href: "/dashboard/logistics", icon: "Truck" },
    { label: "Fotos",      href: "/dashboard/photos",    icon: "Image" },
    { label: "Importar",   href: "/dashboard/import",    icon: "Upload" },
  ],
  supervisor: [
    { label: "Dashboard",  href: "/dashboard",           icon: "LayoutDashboard" },
    { label: "Etapas",     href: "/dashboard/stages",    icon: "Layers" },
    { label: "Logística",  href: "/dashboard/logistics", icon: "Truck" },
    { label: "Fotos",      href: "/dashboard/photos",    icon: "Image" },
  ],
}
