import { useState, useEffect } from 'react'

interface PlatformLogoProps {
  name: string
  className?: string
}

/**
 * Componente que muestra el logotipo de una plataforma de forma dinámica utilizando
 * el servicio de favicons de Google con un fallback elegante a las iniciales de la plataforma.
 */
export function PlatformLogo({ name, className = 'h-5 w-5' }: PlatformLogoProps) {
  const [hasError, setHasError] = useState(false)

  // Resetear el estado de error si el nombre de la plataforma cambia
  useEffect(() => {
    setHasError(false)
  }, [name])

  const getDomainFromName = (n: string): string => {
    const clean = n.trim().toLowerCase()
    if (clean.includes('.')) return clean
    // Remover caracteres especiales y espacios
    const sanitized = clean.replace(/[^a-z0-9]/g, '')
    return sanitized ? `${sanitized}.com` : 'example.com'
  }

  const domain = getDomainFromName(name)
  const initial = name.trim().charAt(0).toUpperCase() || 'P'

  if (hasError) {
    return (
      <div
        className={`${className} rounded-full flex items-center justify-center bg-[#e5e5ea] text-text-secondary text-[10px] font-bold shrink-0 select-none border border-black/[0.03]`}
        aria-hidden="true"
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={`Logo de ${name}`}
      onError={() => setHasError(true)}
      className={`${className} rounded-full shrink-0 object-contain`}
    />
  )
}
