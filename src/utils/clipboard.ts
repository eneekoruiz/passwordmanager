let clipboardClearTimer: number | null = null

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(text)
    if (clipboardClearTimer !== null) {
      window.clearTimeout(clipboardClearTimer)
    }
    clipboardClearTimer = window.setTimeout(() => {
      void navigator.clipboard.writeText('').catch(() => {})
      clipboardClearTimer = null
      window.dispatchEvent(new CustomEvent('clipboard:cleared', { detail: { type: 'clipboard' } }))
    }, 60_000)
    return true
  } catch {
    return false
  }
}
