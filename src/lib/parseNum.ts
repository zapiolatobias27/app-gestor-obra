/**
 * Parsea texto numérico en formato argentino/español:
 *   "100.000"   → 100000   (punto = separador de miles)
 *   "100,5"     → 100.5    (coma = decimal)
 *   "1.000,50"  → 1000.5   (ambos)
 *   "100.5"     → 100.5    (punto con 1-2 dígitos = decimal)
 *   "100000"    → 100000   (sin separadores)
 */
export function parseNum(s: string | number | undefined | null): number {
  if (s == null || s === "") return 0
  const str = String(s).trim().replace(/\s/g, "")
  if (str === "" || str === "-") return 0

  const hasDot   = str.includes(".")
  const hasComma = str.includes(",")

  if (hasDot && hasComma) {
    // 1.000,50 → remove dots, swap comma → 1000.50
    return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0
  }

  if (hasComma && !hasDot) {
    // 100,5 → 100.5
    return parseFloat(str.replace(",", ".")) || 0
  }

  if (hasDot && !hasComma) {
    const parts = str.split(".")
    // Multiple dots (1.000.000) or last segment has exactly 3 digits → thousands
    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      return parseFloat(str.replace(/\./g, "")) || 0
    }
    // Single dot with 1-2 decimal digits → decimal point
    return parseFloat(str) || 0
  }

  return parseFloat(str) || 0
}
