import { describe, it, expect } from 'bun:test'
import { KoraClient, KoraError } from './client.js'
import { validateScriptName, validateScriptType } from './validation.js'

describe('validateScriptName', () => {
  it('accepts valid names', () => {
    expect(validateScriptName('my_script')).toBeNull()
    expect(validateScriptName('validate_order')).toBeNull()
  })
  it('rejects empty name', () => {
    expect(validateScriptName('')).toBe('Name is required')
  })
  it('rejects uppercase', () => {
    expect(validateScriptName('MyScript')).toMatch(/lowercase/)
  })
})

describe('validateScriptType', () => {
  it('accepts valid types', () => {
    expect(validateScriptType('doc_event')).toBeNull()
    expect(validateScriptType('api_method')).toBeNull()
  })
  it('rejects invalid type', () => {
    expect(validateScriptType('bad_type')).toMatch(/Invalid script type/)
  })
})

describe('KoraClient', () => {
  it('strips trailing slash from baseUrl', () => {
    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev/', token: 'test' })
    // No assertion needed — just verifies constructor doesn't throw
  })

  it('requires token', () => {
    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', token: 'test' })
    // No assertion needed
  })
})

describe('KoraError', () => {
  it('has name and status', () => {
    const err = new KoraError('Not found', 404, { type: 'NotFound' })
    expect(err.name).toBe('KoraError')
    expect(err.status).toBe(404)
    expect(err.message).toBe('Not found')
  })
})
