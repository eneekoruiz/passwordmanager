export function passwordStrengthReasons(password: string): string[] {
  const reasons: string[] = []
  if (password.length < 8) reasons.push('Demasiado corta')
  if (!/[A-Z]/.test(password)) reasons.push('Sin mayúsculas')
  if (!/[0-9]/.test(password)) reasons.push('Faltan números')
  if (!/[^A-Za-z0-9]/.test(password)) reasons.push('Sin caracteres especiales')
  return reasons
}

export function passwordStrengthIssue(password: string): boolean {
  return passwordStrengthReasons(password).length > 0
}

export function hasWeakPassword(platform: any): boolean {
  if (platform.ignoreWeakPasswordWarning) return false
  const pwMethod = platform.accessMethods?.find((m: any) => m?.type === 'PASSWORD')
  if (!pwMethod || !pwMethod.password) return false
  return passwordStrengthIssue(pwMethod.password)
}
