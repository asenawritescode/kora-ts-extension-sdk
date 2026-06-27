import type { KoraClientConfig, ScriptRecord, ScriptCreateRequest, ScriptUpdateRequest, ScriptExecution, ExtensionRecord, ExtensionCreateRequest, DeliveryRecord, ExecuteResult } from './types.js'

export class KoraClient {
  readonly #config: Required<KoraClientConfig>

  constructor (config: KoraClientConfig) {
    this.#config = {
      timeout: 30000,
      ...config,
    }
    // Strip trailing slash
    this.#config.baseUrl = this.#config.baseUrl.replace(/\/$/, '')
  }

  /** Execute a custom API method (extension endpoint) */
  async callMethod (name: string, body?: unknown): Promise<unknown> {
    return this.#request('POST', `/api/method/${encodeURIComponent(name)}`, body)
  }

  // ━━ Scripts ━━

  /** List all scripts */
  async listScripts (): Promise<ScriptRecord[]> {
    const res = await this.#request<{ data: ScriptRecord[] }>('GET', '/api/system/script')
    return res.data
  }

  /** Get a script by name */
  async getScript (name: string): Promise<ScriptRecord> {
    const res = await this.#request<{ data: ScriptRecord }>('GET', `/api/system/script/${encodeURIComponent(name)}`)
    return res.data
  }

  /** Create a new script */
  async createScript (req: ScriptCreateRequest): Promise<ScriptRecord> {
    const res = await this.#request<{ data: ScriptRecord }>('POST', '/api/system/script', req)
    return res.data
  }

  /** Update an existing script */
  async updateScript (name: string, req: ScriptUpdateRequest): Promise<void> {
    await this.#request('PUT', `/api/system/script/${encodeURIComponent(name)}`, req)
  }

  /** Delete a script */
  async deleteScript (name: string): Promise<void> {
    await this.#request('DELETE', `/api/system/script/${encodeURIComponent(name)}`)
  }

  /** Get script execution logs */
  async getScriptExecutions (name: string): Promise<ScriptExecution[]> {
    const res = await this.#request<{ data: ScriptExecution[] }>('GET', `/api/system/script/${encodeURIComponent(name)}/executions`)
    return res.data
  }

  /** Validate a script without saving */
  async validateScript (script: string): Promise<{ valid: boolean; error?: string }> {
    return this.#request('POST', '/api/system/script/_validate', { script })
  }

  // ━━ Extensions (Webhooks) ━━

  /** List all extensions */
  async listExtensions (): Promise<ExtensionRecord[]> {
    const res = await this.#request<{ data: ExtensionRecord[] }>('GET', '/api/system/extension')
    return res.data
  }

  /** Create a new extension */
  async createExtension (req: ExtensionCreateRequest): Promise<{ data: ExtensionRecord; secret: string }> {
    return this.#request('POST', '/api/system/extension', req)
  }

  /** Delete an extension */
  async deleteExtension (name: string): Promise<void> {
    await this.#request('DELETE', `/api/system/extension/${encodeURIComponent(name)}`)
  }

  /** Get delivery logs for an extension */
  async getDeliveries (extensionName: string): Promise<DeliveryRecord[]> {
    const res = await this.#request<{ data: DeliveryRecord[] }>('GET', `/api/system/extension/${encodeURIComponent(extensionName)}/deliveries`)
    return res.data
  }

  /** Rotate the HMAC secret for an extension */
  async rotateSecret (name: string): Promise<{ secret: string }> {
    return this.#request('POST', `/api/system/extension/${encodeURIComponent(name)}/rotate-secret`)
  }

  // ━━ Internal ━━

  async #request<T> (method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.#config.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.#config.token}`,
      'Content-Type': 'application/json',
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.#config.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      const data = await response.json()

      if (!response.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : data.error?.message || response.statusText
        throw new KoraError(errMsg, response.status, data.error)
      }

      return data as T
    } finally {
      clearTimeout(timer)
    }
  }
}

export class KoraError extends Error {
  readonly status: number
  readonly detail?: unknown

  constructor (message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'KoraError'
    this.status = status
    this.detail = detail
  }
}
