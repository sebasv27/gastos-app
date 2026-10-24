// src/utils/format.ts
export const fmtCOP = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

export const fmtShortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })

export const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0

export const monthName = (m: number, y: number) =>
  new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
