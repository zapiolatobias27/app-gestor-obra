"use client"

import React from "react"
import Link from "next/link"

export function AppHeader() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Control de Obra</h2>
      </div>
      <Link
        href="/api/auth/logout"
        className="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        Salir
      </Link>
    </header>
  )
}
