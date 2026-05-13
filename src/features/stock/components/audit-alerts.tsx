"use client"

import React from "react"
import { AuditAlert } from "@/types/stock"
import { formatDeviation, getDeviationSeverity } from "@/features/stock/logic/deviation-check"
import { resolveAlert } from "@/lib/mock-db"
import { EmptyState } from "@/components/shared/empty-state"

interface AuditAlertsProps {
  alerts: AuditAlert[]
  onResolve?: () => void
}

export function AuditAlerts({ alerts, onResolve }: AuditAlertsProps) {
  const activeAlerts = alerts.filter((a) => a.status === "active")

  const handleResolve = (alertId: string) => {
    resolveAlert(alertId)
    onResolve?.()
  }

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="text-2xl">✓</div>
          <div>
            <h3 className="font-semibold text-gray-900">Sin alertas activas</h3>
            <p className="text-sm text-gray-600">Todo el stock está dentro de los parámetros</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeAlerts.map((alert) => {
        const severity = getDeviationSeverity(alert.deviationPct)
        const bgColor =
          severity === "high" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
        const badgeColor =
          severity === "high"
            ? "bg-red-100 text-red-800"
            : "bg-yellow-100 text-yellow-800"

        return (
          <div key={alert.id} className={`p-4 rounded-lg border ${bgColor}`}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">Desvío Detectado</h4>
                <p className="text-sm text-gray-700 mt-1">
                  Insumo: <strong>{alert.supplyItemId}</strong>
                </p>
                <p className="text-sm text-gray-700">
                  Teórico: <strong>{alert.plannedQty}</strong> | Real: <strong>{alert.realQty}</strong> |
                  Desvío: <strong>{formatDeviation(alert.deviationPct)}</strong>
                </p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badgeColor}`}>
                  {severity === "high" ? "CRÍTICO" : "ADVERTENCIA"}
                </span>
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                >
                  Resolver
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
