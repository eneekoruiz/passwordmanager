import { describe, expect, it } from 'vitest'
import { createLocalVaultItem, normalizeLocalVaultItem, vaultItemDisplayName } from './vaultItem'

describe('vaultItem normalization and notes resilience', () => {
  it('falls back empty categoryId ("Sin carpeta asignada") to item.type', () => {
    const draft = createLocalVaultItem('SECURE_NOTE', '')
    const normalized = normalizeLocalVaultItem(draft)
    expect(normalized.categoryId).toBe('SECURE_NOTE')
  })

  it('preserves updatedAt during dirty-state normalization comparisons', () => {
    const fixedDate = '2026-01-15T10:30:00.000Z'
    const note = {
      ...createLocalVaultItem('SECURE_NOTE'),
      updatedAt: fixedDate,
      markdown: '  Texto privado  ',
    }
    const normalized = normalizeLocalVaultItem(note, { preserveUpdatedAt: true })
    expect(normalized.updatedAt).toBe(fixedDate)
    expect(normalized.markdown).toBe('Texto privado')
  })

  it('handles undefined markdown safely on SECURE_NOTE', () => {
    const malformed = {
      ...createLocalVaultItem('SECURE_NOTE'),
      markdown: undefined as unknown as string,
    }
    const normalized = normalizeLocalVaultItem(malformed)
    expect(normalized.markdown).toBe('')
  })

  it('extracts smart title from first markdown line when title is default or blank', () => {
    const untitledNote = {
      ...createLocalVaultItem('SECURE_NOTE'),
      title: 'Nota segura',
      markdown: '# Código candado trastero: 4829\nSegunda línea adicional',
    }
    expect(vaultItemDisplayName(untitledNote)).toBe('Código candado trastero: 4829')

    const customTitledNote = {
      ...untitledNote,
      title: 'Trastero Garaje',
    }
    expect(vaultItemDisplayName(customTitledNote)).toBe('Trastero Garaje')
  })
})
