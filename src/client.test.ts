import { afterEach, beforeEach, describe, it, expect, mock } from 'bun:test'
import { KoraClient, KoraError } from './client.js'
import { validateScriptName, validateScriptType } from './validation.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

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
    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev/', siteName: 'demo', token: 'test' })
    // No assertion needed — just verifies constructor doesn't throw
  })

  it('scopes requests to the provided siteName', async () => {
    const fetchSpy = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/s/demo/api/resource/Order')
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo', token: 'test' })
    await client.getList('Order')
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('uses authProvider when present', async () => {
    const fetchSpy = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-from-provider' })
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const client = new KoraClient({
      baseUrl: 'https://myapp.kora.dev',
      siteName: 'demo',
      authProvider: () => 'Bearer token-from-provider',
    })

    await client.getList('Order')
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('formats list queries and calls document endpoints', async () => {
    const fetchSpy = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      expect(url).toContain('/api/resource/Invoice')
      expect(url).toContain('limit=10')
      expect(url).toContain('offset=5')
      expect(url).toContain('order_by=modified+DESC')
      expect(url).toContain('filters=')
      return new Response(JSON.stringify({ data: [{ name: 'INV-0001' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo', token: 'test' })
    const items = await client.getList('Invoice', {
      limit: 10,
      offset: 5,
      orderBy: 'modified DESC',
      filters: [['status', '=', 'Draft']],
    })

    expect(items).toHaveLength(1)
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('creates documents with the generic resource endpoint', async () => {
    const fetchSpy = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/resource/Feedback')
      expect(init?.method).toBe('POST')
      expect(init?.body).toContain('"title":"Great product"')
      return new Response(JSON.stringify({ data: { name: 'FDB-0001' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo', token: 'test' })
    const created = await client.createDoc('Feedback', { title: 'Great product' })

    expect(created).toMatchObject({ name: 'FDB-0001' })
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('supports sequential bulk create operations', async () => {
    const calls: string[] = []
    const fetchSpy = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input))
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const name = body.title === 'A' ? 'FDB-0001' : 'FDB-0002'
      return new Response(JSON.stringify({ data: { name } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo', token: 'test' })
    const results = await client.bulkCreate([
      { doctype: 'Feedback', doc: { title: 'A' } },
      { doctype: 'Feedback', doc: { title: 'B' } },
    ])

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ success: true, data: { name: 'FDB-0001' } })
    expect(results[1]).toMatchObject({ success: true, data: { name: 'FDB-0002' } })
    expect(calls).toHaveLength(2)
  })

  it('supports sequential bulk delete operations', async () => {
    const calls: string[] = []
    const fetchSpy = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input))
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo', token: 'test' })
    const results = await client.bulkDelete([
      { doctype: 'Feedback', name: 'FDB-0001' },
      { doctype: 'Feedback', name: 'FDB-0002' },
    ])

    expect(results).toHaveLength(2)
    expect(results.every((item) => item.success)).toBeTrue()
    expect(calls[0]).toContain('/api/resource/Feedback/FDB-0001')
    expect(calls[1]).toContain('/api/resource/Feedback/FDB-0002')
  })

  it('can expose site context and build file URLs', () => {
    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev/', siteName: 'demo', token: 'test' })
    expect(client.getSiteContext()).toMatchObject({
      baseUrl: 'https://myapp.kora.dev',
      siteName: 'demo',
    })
    expect(client.getFileUrl('image.png')).toBe('https://myapp.kora.dev/s/demo/files/image.png')
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
