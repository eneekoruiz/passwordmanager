/**
 * Formats an ISO date string into a clean, human-readable relative time string in Spanish.
 * Example: "hace unos segundos", "hace 1 minuto", "hace 15 minutos", "hace 2 horas", "hace 1 día".
 */
export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (isNaN(diffInSeconds) || diffInSeconds < 0 || diffInSeconds < 30) {
    return 'hace unos segundos'
  }
  if (diffInSeconds < 90) {
    return 'hace 1 minuto'
  }
  if (diffInSeconds < 3600) {
    return `hace ${Math.floor(diffInSeconds / 60)} minutos`
  }
  if (diffInSeconds < 7200) {
    return 'hace 1 hora'
  }
  if (diffInSeconds < 86400) {
    return `hace ${Math.floor(diffInSeconds / 3600)} horas`
  }
  if (diffInSeconds < 172800) {
    return 'hace 1 día'
  }
  return `hace ${Math.floor(diffInSeconds / 86400)} días`
}
