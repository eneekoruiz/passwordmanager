import { describe, it, expect } from 'vitest'
import { buildAgentVaultJson } from './exportVault'
import type { Identity } from '../types'

describe('buildAgentVaultJson', () => {
  it('extracts explicit apiKeys and developer services into agent format', () => {
    const mockIdentities: Identity[] = [
      {
        id: 'id-1',
        email: 'developer@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        platforms: [
          {
            id: 'p-1',
            type: 'ACCOUNT',
            title: 'Neon DB',
            name: 'Neon',
            username: 'developer@example.com',
            accessMethods: [{ id: 'm-1', type: 'PASSWORD', password: 'my-neon-password' }],
            hardwareKey: false,
            fullName: null,
            birthDate: null,
            accountCreatedAt: null,
            linkedPhone: null,
            twoFactorAuth: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            apiKeys: [
              {
                id: 'k-1',
                nombre: 'api_key',
                descripcion: 'CLI key',
                valor: 'napi_test_123456789'
              }
            ]
          },
          {
            id: 'p-2',
            type: 'ACCOUNT',
            title: 'OpenAI Dev',
            name: 'OpenAI',
            username: 'developer@example.com',
            accessMethods: [{ id: 'm-2', type: 'PASSWORD', password: 'sk-proj-test1234' }],
            hardwareKey: false,
            fullName: null,
            birthDate: null,
            accountCreatedAt: null,
            linkedPhone: null,
            twoFactorAuth: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }
    ]

    const result = buildAgentVaultJson(mockIdentities)

    expect(result).toBeDefined()
    expect(result.neon).toBeDefined()
    expect(result.neon.api_key).toBe('napi_test_123456789')
    expect(result.openai).toBeDefined()
    expect(result.openai.api_key).toBe('sk-proj-test1234')
  })
})
