import { secureRandomInt, secureShuffle } from './random'

interface PasswordGeneratorOptions {
  uppercase?: boolean
  numbers?: boolean
  symbols?: boolean
}

export function generateSecurePassword(length: number = 16): string {
  return generateSecurePasswordWithOptions(length)
}

export function generateSecurePasswordWithOptions(
  length: number = 16,
  options: PasswordGeneratorOptions = {},
): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  const includeUppercase = options.uppercase ?? true
  const includeNumbers = options.numbers ?? true
  const includeSymbols = options.symbols ?? true
  const pools = [
    lowercase,
    ...(includeUppercase ? [uppercase] : []),
    ...(includeNumbers ? [numbers] : []),
    ...(includeSymbols ? [symbols] : []),
  ]
  const safeLength = Math.max(length, pools.length, 8)
  const allChars = pools.join('')
  const password: string[] = pools.map((pool) => pool[secureRandomInt(pool.length)])

  for (let i = password.length; i < safeLength; i++) {
    password.push(allChars[secureRandomInt(allChars.length)])
  }

  return secureShuffle(password).join('')
}

export async function hashEmailForDirectory(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function evaluatePassword(password: string): { isWeak: boolean, reasons: string[], recommendations: string[] } {
  const reasons: string[] = []
  const recommendations: string[] = []
  let isWeak = false

  if (password.length < 8) {
    isWeak = true
    reasons.push('Demasiado corta (menos de 8 caracteres)')
    recommendations.push('Usa al menos 12-16 caracteres para mayor seguridad.')
  } else if (password.length < 12) {
    recommendations.push('Considera aumentar la longitud a 12 o más caracteres.')
  }

  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  if (!hasUpper && !hasLower) {
    isWeak = true
    reasons.push('Sin letras (ni mayúsculas ni minúsculas)')
    recommendations.push('Añade letras mayúsculas y minúsculas.')
  } else if (!hasUpper) {
    reasons.push('Sin mayúsculas')
    recommendations.push('Incluye al menos una letra mayúscula.')
  } else if (!hasLower) {
    reasons.push('Sin minúsculas')
    recommendations.push('Incluye al menos una letra minúscula.')
  }

  if (!hasNumber) {
    reasons.push('Sin números')
    recommendations.push('Añade números para incrementar la complejidad.')
  }
  if (!hasSymbol) {
    reasons.push('Sin símbolos o caracteres especiales')
    recommendations.push('Añade caracteres especiales (ej. !@#$%^&*).')
  }

  // Comprobar caracteres repetidos (ej. aaaaa, 1111)
  if (/(.)\1{2,}/.test(password)) {
    isWeak = true
    reasons.push('Contiene caracteres idénticos repetidos secuencialmente')
    recommendations.push('Evita usar el mismo carácter varias veces seguidas.')
  }

  // Comprobar secuencias de teclado o diccionario comunes muy obvias
  const commonSequences = ['12345', 'qwerty', 'asdfg', 'zxcvb', 'password', 'admin', '123123', 'qazwsx']
  const lowerPw = password.toLowerCase()
  if (commonSequences.some(seq => lowerPw.includes(seq))) {
    isWeak = true
    reasons.push('Contiene secuencias comunes o fáciles de adivinar')
    recommendations.push('No uses palabras del diccionario o secuencias de teclado predecibles.')
  }

  // Si tiene menos de 10 caracteres y no tiene los 4 tipos, es inherentemente débil hoy en día
  if (password.length < 10 && !(hasUpper && hasLower && hasNumber && hasSymbol)) {
    isWeak = true
  }

  return { isWeak, reasons, recommendations }
}

export function passwordStrengthReasons(password: string): string[] {
  return evaluatePassword(password).reasons
}

export function passwordStrengthIssue(password: string): boolean {
  return evaluatePassword(password).isWeak
}

export function hasWeakPassword(platform: any): boolean {
  if (platform.ignoreWeakPasswordWarning) return false
  const pwMethod = platform.accessMethods?.find((m: any) => m?.type === 'PASSWORD')
  if (!pwMethod || !pwMethod.password) return false
  return passwordStrengthIssue(pwMethod.password)
}

export function checkPasswordBreach(password: string): Promise<number> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    return crypto.subtle.digest('SHA-1', data).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
      const prefix = hashHex.slice(0, 5)
      const suffix = hashHex.slice(5)
      return fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
        .then(r => r.ok ? r.text() : '')
        .then(text => {
          for (const line of text.split('\n')) {
            const [lineSuffix, count] = line.split(':')
            if (lineSuffix.trim() === suffix) return parseInt(count.trim(), 10)
          }
          return 0
        })
    })
  } catch {
    return Promise.resolve(0)
  }
}

let _exposedPasswordsCache: Set<string> | null = null

export function getExposedPasswordsCache(): Set<string> {
  if (_exposedPasswordsCache) return _exposedPasswordsCache
  try {
    const saved = localStorage.getItem('contras_exposed_passwords')
    _exposedPasswordsCache = saved ? new Set(JSON.parse(saved)) : new Set()
  } catch {
    _exposedPasswordsCache = new Set()
  }
  return _exposedPasswordsCache
}

export function addExposedPasswordToCache(password: string) {
  const cache = getExposedPasswordsCache()
  cache.add(password)
  localStorage.setItem('contras_exposed_passwords', JSON.stringify(Array.from(cache)))
}

export function clearExposedPasswordCache() {
  _exposedPasswordsCache = new Set()
  localStorage.removeItem('contras_exposed_passwords')
}

export function isPasswordExposedInCache(password: string): boolean {
  return getExposedPasswordsCache().has(password)
}

export function hasExposedPassword(platform: any): boolean {
  if (platform.ignoreExposedPasswordWarning) return false
  return platform.exposedBreachCount !== undefined && platform.exposedBreachCount !== null && platform.exposedBreachCount > 0
}

/** Returns the age of a password in days based on the most recent passwordHistory entry or updatedAt */
export function getPasswordAgeDays(platform: any): number | null {
  const history: Array<{ changedAt: string }> = platform.passwordHistory ?? []
  const mostRecent = history.length > 0
    ? history.reduce((latest, entry) => (entry.changedAt > latest.changedAt ? entry : latest))
    : null
  const ref = mostRecent?.changedAt ?? platform.updatedAt ?? platform.createdAt
  if (!ref) return null
  const diff = Date.now() - new Date(ref).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/** True if the password has not been changed in 90+ days */
export function hasOldPassword(platform: any): boolean {
  if (platform.ignoreWeakPasswordWarning) return false
  const pwMethod = platform.accessMethods?.find((m: any) => m?.type === 'PASSWORD')
  if (!pwMethod?.password) return false
  const days = getPasswordAgeDays(platform)
  if (days === null) return false
  return days >= 90
}

