import React from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  variant?: "default" | "success" | "warning" | "danger"
  className?: string
}

export function StatCard({ label, value, subtext, variant = "default", className }: StatCardProps) {
  const bgClass = {
    default: "bg-blue-50 border-blue-200",
    success: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    danger: "bg-red-50 border-red-200",
  }[variant]

  const textClass = {
    default: "text-blue-900",
    success: "text-green-900",
    warning: "text-yellow-900",
    danger: "text-red-900",
  }[variant]

  const labelClass = {
    default: "text-blue-700",
    success: "text-green-700",
    warning: "text-yellow-700",
    danger: "text-red-700",
  }[variant]

  return (
    <div
      className={cn(
        "p-6 rounded-lg border",
        bgClass,
        className
      )}
    >
      <p className={cn("text-sm font-medium", labelClass)}>{label}</p>
      <p className={cn("text-3xl font-bold mt-2", textClass)}>{value}</p>
      {subtext && <p className={cn("text-xs mt-2", labelClass)}>{subtext}</p>}
    </div>
  )
}
