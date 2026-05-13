import { ExcelImportRow, ImportResult } from "@/types/stock"
import { Stage, Task } from "@/types/project"
import { SupplyItem } from "@/types/stock"

export function parseExcelJSON(rows: ExcelImportRow[]): ImportResult {
  const errors: { row: number; message: string }[] = []
  const stagesMap = new Map<string, Stage>()
  const tasks: Task[] = []
  const supplies: SupplyItem[] = []

  rows.forEach((row, index) => {
    const rowNum = index + 1

    // Validar campos requeridos
    if (!row.etapa?.trim()) {
      errors.push({ row: rowNum, message: "Campo 'etapa' requerido" })
      return
    }
    if (!row.tarea?.trim()) {
      errors.push({ row: rowNum, message: "Campo 'tarea' requerido" })
      return
    }
    if (!row.insumo?.trim()) {
      errors.push({ row: rowNum, message: "Campo 'insumo' requerido" })
      return
    }
    if (!row.cantidad || isNaN(row.cantidad) || row.cantidad <= 0) {
      errors.push({ row: rowNum, message: "Campo 'cantidad' inválido (debe ser número > 0)" })
      return
    }
    if (!row.unidad?.trim()) {
      errors.push({ row: rowNum, message: "Campo 'unidad' requerido" })
      return
    }

    const etapaNorm = row.etapa.trim()
    const tareaNorm = row.tarea.trim()
    const insumoNorm = row.insumo.trim()

    // Crear Stage si no existe
    if (!stagesMap.has(etapaNorm)) {
      const stageId = `stage-import-${stagesMap.size + 1}`
      const stage: Stage = {
        id: stageId,
        projectId: "proj-1",
        code: `ET${stagesMap.size + 9}`,
        name: etapaNorm,
        order: stagesMap.size + 9,
        status: "pending",
      }
      stagesMap.set(etapaNorm, stage)
    }

    const stage = stagesMap.get(etapaNorm)!
    const taskId = `task-import-${tasks.length + 1}`

    // Crear Task
    const task: Task = {
      id: taskId,
      stageId: stage.id,
      category: "Importado",
      title: tareaNorm,
      status: "pending",
      responsibleRole: "supervisor",
      photos: [],
    }
    tasks.push(task)

    // Crear SupplyItem
    const supply: SupplyItem = {
      id: `sup-import-${supplies.length + 1}`,
      stageId: stage.id,
      taskId: taskId,
      name: insumoNorm,
      unit: row.unidad.trim(),
      plannedQty: row.cantidad,
      realQty: row.cantidad, // inicializa igual al consumo teórico
    }
    supplies.push(supply)
  })

  return {
    success: errors.length === 0,
    stages: Array.from(stagesMap.values()),
    tasks,
    supplies,
    errors,
  }
}
