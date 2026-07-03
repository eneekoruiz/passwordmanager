import { secureRandomInt } from './random'

const RECOVERY_WORDS = [
  'acero', 'aguila', 'alba', 'ambar', 'ancla', 'arbol', 'arena', 'astro',
  'aula', 'aurora', 'avion', 'azul', 'balsa', 'bambu', 'barco', 'brisa',
  'bronce', 'cable', 'cactus', 'campo', 'canal', 'carbon', 'carta', 'cifra',
  'cobre', 'cometa', 'coral', 'delta', 'duna', 'eco', 'elite', 'enlace',
  'escudo', 'esfera', 'faro', 'fibra', 'firma', 'foco', 'fuego', 'gala',
  'gema', 'glaciar', 'halo', 'helio', 'hilo', 'icono', 'isla', 'jade',
  'junco', 'karma', 'laser', 'lima', 'llave', 'lumen', 'mapa', 'marfil',
  'matriz', 'metal', 'miga', 'nexo', 'nieve', 'nube', 'omega', 'onda',
  'orbita', 'palma', 'papel', 'perla', 'piedra', 'pixel', 'plata', 'prisma',
  'pulso', 'quartz', 'radio', 'radar', 'raiz', 'rayo', 'red', 'roble',
  'rueda', 'safir', 'salto', 'saturno', 'senal', 'sigma', 'solar', 'sombra',
  'tabla', 'tango', 'tecla', 'templo', 'tierra', 'token', 'torre', 'trazo',
  'ultra', 'umbral', 'union', 'valle', 'vapor', 'vector', 'vela', 'verde',
  'vertice', 'viaje', 'vidrio', 'wifi', 'xenon', 'yunque', 'zafiro', 'zenit',
  'zona', 'norte', 'sur', 'este', 'oeste', 'nivel', 'clave', 'ritmo',
  'pluma', 'costa', 'marea', 'bosque', 'nodo', 'puerto', 'ronda', 'marca',
]

export const RECOVERY_PHRASE_WORD_COUNT = 18

export function generateRecoveryPhrase(wordCount = RECOVERY_PHRASE_WORD_COUNT): string {
  return Array.from(
    { length: wordCount },
    () => RECOVERY_WORDS[secureRandomInt(RECOVERY_WORDS.length)],
  ).join(' ')
}

export function normalizeRecoveryPhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
