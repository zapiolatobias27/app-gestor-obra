import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda ARS sin decimales.
 * Definida localmente en múltiples páginas — centralizada aquí para reutilización.
 */
export function fmt(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) como fecha legible en español (AR).
 * Ej: "2024-03-15" → "15 de marzo de 2024"
 */
export function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Formatea un ISO datetime como fecha+hora corta en español (AR).
 * Ej: "2024-03-15T14:30:00Z" → "15 de mar, 14:30"
 */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
