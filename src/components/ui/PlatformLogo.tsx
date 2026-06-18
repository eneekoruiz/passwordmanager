import { useState, useEffect } from 'react'
import { POPULAR_SERVICES } from '../../data/popularServices'

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
  const [src, setSrc] = useState('')

  const getDomainFromName = (n: string): string => {
    const clean = n.trim().toLowerCase()
    const known = POPULAR_SERVICES.find((service) => service.name.toLowerCase() === clean)
    if (known) return known.domain
    if (clean.includes('.')) return clean
    // Remover caracteres especiales y espacios
    const sanitized = clean.replace(/[^a-z0-9]/g, '')
    return sanitized ? `${sanitized}.com` : 'example.com'
  }

  const domain = getDomainFromName(name)
  const initial = name.trim().charAt(0).toUpperCase() || 'P'

  // Resetear el estado de error y establecer src inicial si el nombre de la plataforma cambia
  useEffect(() => {
    setHasError(false)
    setSrc(`https://logo.clearbit.com/${domain}`)
  }, [name, domain])

  const handleImageError = () => {
    if (src === `https://logo.clearbit.com/${domain}`) {
      setSrc(`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`)
    } else if (src === `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`) {
      setSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)
    } else {
      setHasError(true)
    }
  }

  if (hasError || !src) {
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
      src={src}
      alt={`Logo de ${name}`}
      onError={handleImageError}
      className={`${className} rounded-full shrink-0 object-contain bg-white`}
    />
  )
}
