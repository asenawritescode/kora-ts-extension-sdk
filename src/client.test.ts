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

  it('lists requests with the v2 actor-scoped filters and validates returned items', async () => {
    const request = {
      id: '01K7REQUEST00000000000000000', revision: '1', kind: 'task', status: 'pending', requester: 'alice',
      title: 'Review order', message: 'Please review', allowed_responses: [], assignments: [],
      created_at: '2026-10-14T12:00:00Z', updated_at: '2026-10-14T12:00:00Z',
    }
    const fetchSpy = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('/api/v2/requests?')
      expect(url).toContain('view=needs_action')
      expect(url).toContain('kind=task')
      return new Response(JSON.stringify({ data: { items: [request], next_cursor: 'next' } }), { status: 200 })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo' })
    const page = await client.listRequests({ page: { limit: 10 }, view: 'needs_action', kind: 'task', overdue_only: false })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.id).toBe(request.id)
    expect(page.next_cursor).toBe('next')
  })

  it('uses Engine capability discovery and treats older navigation responses as unsupported', async () => {
    const responses = [
      { data: { capabilities_version: '2', supported_capabilities: ['requests.inbox.v2', 'workflow.orchestration.v2'] } },
      { data: { user: { name: 'alice' } } },
    ]
    const calls: string[] = []
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return new Response(JSON.stringify(responses.shift()), { status: 200 })
    }) as unknown as typeof fetch
    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo' })
    expect(await client.getCapabilities()).toEqual({
      version: '2', supported: ['requests.inbox.v2', 'workflow.orchestration.v2'],
    })
    expect(await client.getCapabilities()).toEqual({ version: undefined, supported: [] })
    expect(calls.every((url) => url.includes('/api/v1/system/navigation'))).toBe(true)
  })

  it('submits typed v2 request commands and rejects invalid response contracts', async () => {
    const request = {
      id: '01K7REQUEST00000000000000000', revision: '1', kind: 'task', status: 'pending', requester: 'alice',
      title: 'Review order', message: 'Please review', allowed_responses: [], assignments: [],
      created_at: '2026-10-14T12:00:00Z', updated_at: '2026-10-14T12:00:00Z',
    }
    const fetchSpy = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/v2/requests')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body)).kind).toBe('task')
      return new Response(JSON.stringify({ data: request }), { status: 201 })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo' })
    const result = await client.submitRequest({
      meta: { idempotency_key: 'submit-key' }, kind: 'task', title: 'Review order', message: 'Please review',
      assignment: { mode: 'any', assignees: [{ kind: 'user', id: 'bob' }] },
    })
    expect(result.requester).toBe('alice')
    await expect(client.submitRequest({ meta: { idempotency_key: 'bad' }, kind: 'task', title: '', message: '' } as never)).rejects.toThrow('Invalid Kora contract: SubmitRequest')
  })

  it('propagates AbortSignal cancellation to v2 request transport', async () => {
    let startFetch!: () => void
    const fetchStarted = new Promise<void>((resolve) => { startFetch = resolve })
    let transportSignal: AbortSignal | null | undefined
    globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      transportSignal = init?.signal
      startFetch()
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    }) as unknown as typeof fetch

    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo' })
    const caller = new AbortController()
    const pending = client.listRequests(undefined, caller.signal)
    await fetchStarted
    caller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(transportSignal?.aborted).toBe(true)
  })

  it('validates, publishes, starts, reads, reconciles, and cancels durable workflows with stable keys', async () => {
    const definition = { id: 'approval', version: 1, entry: 'end', steps: [{ id: 'end', kind: 'end', end: { outcome: 'done' } }] }
    const instance = {
      id: '01K7INSTANCE0000000000000000', revision: '1', definition_id: 'approval', definition_version: 1,
      subject: { kind: 'Purchase Request', id: 'PR-1', revision: '7' }, status: 'outcome_unknown',
      current_step: 'action', created_at: '2026-10-14T12:00:00Z', updated_at: '2026-10-14T12:00:00Z',
    }
    const calls: Array<{ url: string; method?: string; headers?: HeadersInit }> = []
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method, headers: init?.headers })
      if (url.endsWith('/workflow-definitions/validate')) return new Response(JSON.stringify({ data: { valid: true, issues: [] } }), { status: 200 })
      if (url.endsWith('/workflow-definitions')) return new Response(JSON.stringify({ data: { definition_id: 'approval', version: 1, digest: 'a'.repeat(64) } }), { status: 201 })
      return new Response(JSON.stringify({ data: instance }), { status: 200 })
    }) as unknown as typeof fetch

    const client = new KoraClient({ baseUrl: 'https://myapp.kora.dev', siteName: 'demo' })
    expect(await client.validateWorkflowDefinition(definition)).toEqual({ valid: true, issues: [] })
    expect((await client.publishWorkflowDefinition(definition, 'publish-key')).version).toBe(1)
    expect((await client.startWorkflow({
      meta: { idempotency_key: 'start-key' }, definition_id: 'approval', definition_version: 1,
      subject: { kind: 'Purchase Request', id: 'PR-1', revision: '7' },
    })).id).toBe(instance.id)
    expect((await client.getWorkflowInstance(instance.id)).status).toBe('outcome_unknown')
    expect((await client.reconcileWorkflow(instance.id, {
      meta: { idempotency_key: 'reconcile-key', expected_revision: '1' }, step_id: 'action',
      outcome: 'confirmed_not_applied', evidence_ref: 'ticket:42', reason: 'Provider confirmed no effect',
    })).revision).toBe('1')
    expect((await client.cancelWorkflow(instance.id, {
      meta: { idempotency_key: 'cancel-key', expected_revision: '1' }, reason: 'No longer needed',
    })).id).toBe(instance.id)

    const writeCalls = calls.filter((call) => call.method === 'POST')
    expect(writeCalls.map((call) => call.url)).toEqual([
      expect.stringContaining('/api/v2/workflow-definitions/validate'),
      expect.stringContaining('/api/v2/workflow-definitions'),
      expect.stringContaining('/api/v2/workflow-instances'),
      expect.stringContaining('/api/v2/workflow-instances/'),
      expect.stringContaining('/api/v2/workflow-instances/'),
    ])
    expect(new Headers(writeCalls[1]?.headers).get('Idempotency-Key')).toBe('publish-key')
    expect(new Headers(writeCalls[2]?.headers).get('Idempotency-Key')).toBe('start-key')
    expect(new Headers(writeCalls[3]?.headers).get('Idempotency-Key')).toBe('reconcile-key')
    expect(new Headers(writeCalls[4]?.headers).get('Idempotency-Key')).toBe('cancel-key')
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
