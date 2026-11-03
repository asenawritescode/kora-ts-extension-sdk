import type {
  KoraClientConfig,
  SiteContext,
  ScriptRecord,
  ScriptCreateRequest,
  ScriptUpdateRequest,
  ScriptExecution,
  ExtensionRecord,
  ExtensionCreateRequest,
  DeliveryRecord,
  ExecuteResult,
  DocumentEnvelope,
  ListEnvelope,
  ListQuery,
  DocType,
  View,
  Workflow,
  FileRef,
  Query,
  BulkDocItem,
  BulkDocResult,
} from './types.js'
import {
  decodeContract,
  isContract,
  type BusinessScope,
  type CancelRequest,
  type PageRequest,
  type ReassignRequest,
  type RequestFilter,
  type RequestHistoryEntry,
  type RequestView,
  type RespondRequest,
  type ResponseDetail,
  type ResponseReceipt,
  type SubmitRequest,
  type WorkflowDefinition,
  type ValidationResult,
  type DefinitionVersionRef,
  type StartWorkflow,
  type WorkflowInstance,
  type ReconcileWorkflow,
  type CancelWorkflow,
  type ApplicationCatalog,
  type ExecutePublishedOperation,
  type LookupPublishedOperation,
  type OperationReceipt,
  type PublishedQueryRequest,
  type QueryResult,
  type SchemaRef,
} from './generated/engine-v2.js'
import { assertPublishedSchema } from './schema-validation.js'

export class KoraClient {
  readonly #config: {
    baseUrl: string
    siteName: string
    timeout: number
    token?: string
    authHeader?: string
    authProvider?: KoraClientConfig['authProvider']
    fetch?: typeof fetch
  }
  readonly #fetchImpl: typeof fetch

  constructor (config: KoraClientConfig) {
    this.#config = {
      timeout: 30000,
      ...config,
    }
    // Strip trailing slash
    this.#config.baseUrl = this.#config.baseUrl.replace(/\/$/, '')
    this.#config.siteName = this.#config.siteName.trim()
    this.#fetchImpl = config.fetch ?? fetch
  }

  /** Return an immutable view of this client bound to one canonical business scope. */
  withScope (scope: BusinessScope): KoraScopedClient {
    validateBusinessScope(scope)
    const scopedScope = Object.freeze({ ...scope })
    const parent = this
    return Object.freeze({
      scope: scopedScope,
      request: <T>(method: string, path: string, body?: unknown, signal?: AbortSignal) =>
        parent.#requestScoped<T>(scopedScope, method, path, body, signal),
      catalog: (signal?: AbortSignal) => parent.#getCatalog(scopedScope, signal),
      queryPublished: (catalog: ApplicationCatalog, owner: string, name: string, request: PublishedQueryRequest, signal?: AbortSignal) => parent.#queryPublished(scopedScope, catalog, owner, name, request, signal),
      getProjection: (catalog: ApplicationCatalog, owner: string, id: string, signal?: AbortSignal) => parent.#getProjection(scopedScope, catalog, owner, id, signal),
      executeOperation: (catalog: ApplicationCatalog, operationRef: string, command: ExecutePublishedOperation, signal?: AbortSignal) => parent.#executeOperation(scopedScope, catalog, operationRef, command, signal),
      getExecution: (catalog: ApplicationCatalog, executionId: string, signal?: AbortSignal) => parent.#getExecution(scopedScope, catalog, executionId, signal),
      lookupExecution: (catalog: ApplicationCatalog, lookup: LookupPublishedOperation, signal?: AbortSignal) => parent.#lookupExecution(scopedScope, catalog, lookup, signal),
    })
  }

  /** Execute a custom API method (extension endpoint) */
  async callMethod (name: string, body?: unknown): Promise<unknown> {
    return this.#request('POST', `/api/method/${encodeURIComponent(name)}`, body)
  }

  /** Return the current site context. */
  getSiteContext (): SiteContext {
    return {
      baseUrl: this.#config.baseUrl,
      siteName: this.#config.siteName,
      authHeader: this.#config.authHeader,
      timeout: this.#config.timeout,
    }
  }

  /** List all DocTypes for the connected site. */
  async listDoctypes (): Promise<DocType[]> {
    const res = await this.#request<{ data: DocType[] }>('GET', '/api/system/doctypes')
    return res.data
  }

  /** Get a single DocType definition. */
  async getDoctype (doctype: string): Promise<DocType> {
    const res = await this.#request<{ data: DocType }>('GET', `/api/system/doctype/${encodeURIComponent(doctype)}`)
    return res.data
  }

  /** Get the configured views for the site. */
  async listViews (): Promise<View[]> {
    const res = await this.#request<{ data: View[] }>('GET', '/api/v1/system/views')
    return res.data
  }

  /** Get a view by name. */
  async getView (name: string): Promise<View> {
    const res = await this.#request<{ data: View }>('GET', `/api/v1/system/views/${encodeURIComponent(name)}`)
    return res.data
  }

  /** Get workflow config for a doctype. */
  async getWorkflow (doctype: string): Promise<Workflow> {
    const res = await this.#request<{ data: Workflow }>('GET', `/api/system/workflows/${encodeURIComponent(doctype)}`)
    return res.data
  }

  /** Read server-advertised optional features. Older Engines return an empty capability list. */
  async getCapabilities (signal?: AbortSignal): Promise<{ version?: string; supported: string[] }> {
    const response = await this.#request<{ data: unknown }>('GET', '/api/v1/system/navigation', undefined, signal)
    if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
      throw new TypeError('Invalid Kora capability response')
    }
    const navigation = response.data as { capabilities_version?: unknown; supported_capabilities?: unknown }
    const supported = navigation.supported_capabilities
    if (supported === undefined) return { version: typeof navigation.capabilities_version === 'string' ? navigation.capabilities_version : undefined, supported: [] }
    if (!Array.isArray(supported) || !supported.every((value) => typeof value === 'string')) {
      throw new TypeError('Invalid Kora capability response')
    }
    return {
      version: typeof navigation.capabilities_version === 'string' ? navigation.capabilities_version : undefined,
      supported,
    }
  }

  /** List the actor-scoped v2 request inbox. The server applies visibility and assignment rules. */
  async listRequests (filter: RequestFilter = { page: { limit: 25 }, view: 'needs_action', overdue_only: false }, signal?: AbortSignal): Promise<{ items: RequestView[]; next_cursor?: string }> {
    const page = filter.page
    const params = new URLSearchParams({ view: filter.view, limit: String(page.limit), overdue_only: String(filter.overdue_only) })
    if (page.cursor) params.set('cursor', page.cursor)
    if (filter.kind) params.set('kind', filter.kind)
    const response = await this.#request<{ data: unknown }>('GET', `/api/v2/requests?${params.toString()}`, undefined, signal)
    if (!isRequestPage(response.data, 'RequestView')) throw new TypeError('Invalid Kora contract: Page<RequestView>')
    return response.data as { items: RequestView[]; next_cursor?: string }
  }

  /** Read one request after the server verifies participant visibility. */
  async getRequest (id: string, signal?: AbortSignal): Promise<RequestView> {
    const response = await this.#request<{ data: unknown }>('GET', `/api/v2/requests/${encodeURIComponent(id)}`, undefined, signal)
    return decodeContract<RequestView>('RequestView', response.data)
  }

  /** Submit a request using the authenticated actor; requester identity is never supplied by the client. */
  async submitRequest (command: SubmitRequest, signal?: AbortSignal): Promise<RequestView> {
    decodeContract<SubmitRequest>('SubmitRequest', command)
    const response = await this.#request<{ data: unknown }>('POST', '/api/v2/requests', command, signal)
    return decodeContract<RequestView>('RequestView', response.data)
  }

  /** Record a response. The Engine rechecks current assignment eligibility and revision. */
  async respondToRequest (id: string, command: RespondRequest, signal?: AbortSignal): Promise<ResponseReceipt> {
    decodeContract<RespondRequest>('RespondRequest', command)
    const response = await this.#request<{ data: unknown }>('POST', `/api/v2/requests/${encodeURIComponent(id)}/responses`, command, signal)
    return decodeContract<ResponseReceipt>('ResponseReceipt', response.data)
  }

  async reassignRequest (id: string, command: ReassignRequest, signal?: AbortSignal): Promise<RequestView> {
    decodeContract<ReassignRequest>('ReassignRequest', command)
    const response = await this.#request<{ data: unknown }>('POST', `/api/v2/requests/${encodeURIComponent(id)}/reassignments`, command, signal)
    return decodeContract<RequestView>('RequestView', response.data)
  }

  async cancelRequest (id: string, command: CancelRequest, signal?: AbortSignal): Promise<RequestView> {
    decodeContract<CancelRequest>('CancelRequest', command)
    const response = await this.#request<{ data: unknown }>('POST', `/api/v2/requests/${encodeURIComponent(id)}/cancel`, command, signal)
    return decodeContract<RequestView>('RequestView', response.data)
  }

  async getRequestHistory (id: string, page: PageRequest = { limit: 25 }, signal?: AbortSignal): Promise<{ items: RequestHistoryEntry[]; next_cursor?: string }> {
    const params = new URLSearchParams({ limit: String(page.limit) })
    if (page.cursor) params.set('cursor', page.cursor)
    const response = await this.#request<{ data: unknown }>('GET', `/api/v2/requests/${encodeURIComponent(id)}/history?${params.toString()}`, undefined, signal)
    if (!isRequestPage(response.data, 'RequestHistoryEntry')) throw new TypeError('Invalid Kora contract: Page<RequestHistoryEntry>')
    return response.data as { items: RequestHistoryEntry[]; next_cursor?: string }
  }

  async getRequestResponse (id: string, decisionId: string, signal?: AbortSignal): Promise<ResponseDetail> {
    const response = await this.#request<{ data: unknown }>('GET', `/api/v2/requests/${encodeURIComponent(id)}/responses/${encodeURIComponent(decisionId)}`, undefined, signal)
    return decodeContract<ResponseDetail>('ResponseDetail', response.data)
  }

  async markRequestRead (id: string, signal?: AbortSignal): Promise<void> {
    await this.#request('POST', `/api/v2/requests/${encodeURIComponent(id)}/read`, undefined, signal)
  }

  /** Validate a durable process definition without publishing a version. */
  async validateWorkflowDefinition (definition: WorkflowDefinition, signal?: AbortSignal): Promise<ValidationResult> {
    decodeContract<WorkflowDefinition>('WorkflowDefinition', definition)
    const response = await this.#request<{ data: unknown }>('POST', '/api/v2/workflow-definitions/validate', definition, signal)
    return decodeContract<ValidationResult>('ValidationResult', response.data)
  }

  /** Publish an immutable workflow definition version using a caller-stable idempotency key. */
  async publishWorkflowDefinition (definition: WorkflowDefinition, idempotencyKey: string, signal?: AbortSignal): Promise<DefinitionVersionRef> {
    decodeContract<WorkflowDefinition>('WorkflowDefinition', definition)
    const response = await this.#request<{ data: unknown }>('POST', '/api/v2/workflow-definitions', definition, signal, { 'Idempotency-Key': idempotencyKey })
    return decodeContract<DefinitionVersionRef>('DefinitionVersionRef', response.data)
  }

  /** Start a durable workflow instance; the Engine derives actor identity from the authenticated request. */
  async startWorkflow (command: StartWorkflow, signal?: AbortSignal): Promise<WorkflowInstance> {
    decodeContract<StartWorkflow>('StartWorkflow', command)
    const response = await this.#request<{ data: unknown }>('POST', '/api/v2/workflow-instances', command, signal, { 'Idempotency-Key': command.meta.idempotency_key })
    return decodeContract<WorkflowInstance>('WorkflowInstance', response.data)
  }

  /** Read an instance visible to the authenticated execution identity. */
  async getWorkflowInstance (id: string, signal?: AbortSignal): Promise<WorkflowInstance> {
    const response = await this.#request<{ data: unknown }>('GET', `/api/v2/workflow-instances/${encodeURIComponent(id)}`, undefined, signal)
    return decodeContract<WorkflowInstance>('WorkflowInstance', response.data)
  }

  /** Reconcile an uncertain external action with explicit evidence and a stable idempotency key. */
  async reconcileWorkflow (id: string, command: ReconcileWorkflow, signal?: AbortSignal): Promise<WorkflowInstance> {
    decodeContract<ReconcileWorkflow>('ReconcileWorkflow', command)
    const response = await this.#request<{ data: unknown }>('POST', `/api/v2/workflow-instances/${encodeURIComponent(id)}/reconcile`, command, signal, { 'Idempotency-Key': command.meta.idempotency_key })
    return decodeContract<WorkflowInstance>('WorkflowInstance', response.data)
  }

  /** Cancel a durable workflow instance with a revision-bound command. */
  async cancelWorkflow (id: string, command: CancelWorkflow, signal?: AbortSignal): Promise<WorkflowInstance> {
    decodeContract<CancelWorkflow>('CancelWorkflow', command)
    const response = await this.#request<{ data: unknown }>('POST', `/api/v2/workflow-instances/${encodeURIComponent(id)}/cancel`, command, signal, { 'Idempotency-Key': command.meta.idempotency_key })
    return decodeContract<WorkflowInstance>('WorkflowInstance', response.data)
  }

  /** Read a supporting record that the Engine permits this caller to access. */
  async getSupportingRecord<T = Record<string, unknown>> (doctype: string, name: string): Promise<T> {
    const res = await this.#request<DocumentEnvelope<T>>('GET', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`)
    return res.data
  }

  /** List permitted supporting records for a doctype. */
  async listSupportingRecords<T = Record<string, unknown>> (doctype: string, query: ListQuery = {}): Promise<T[]> {
    const params = new URLSearchParams()
    if (query.limit !== undefined) params.set('limit', String(query.limit))
    if (query.offset !== undefined) params.set('offset', String(query.offset))
    if (query.orderBy) params.set('order_by', query.orderBy)
    if (query.filters !== undefined) {
      params.set('filters', typeof query.filters === 'string'
        ? query.filters
        : JSON.stringify(query.filters))
    }
    if (query.fields && query.fields.length) params.set('fields', JSON.stringify(query.fields))
    if (query.search) params.set('search', query.search)
    if (query.groupBy) params.set('group_by', query.groupBy)
    const queryString = params.toString()
    const res = await this.#request<ListEnvelope<T>>('GET', `/api/resource/${encodeURIComponent(doctype)}${queryString ? `?${queryString}` : ''}`)
    return res.data
  }

  /** Create a permitted supporting record. */
  async createSupportingRecord<T = Record<string, unknown>> (doctype: string, doc: Record<string, unknown>): Promise<T> {
    const res = await this.#request<DocumentEnvelope<T>>('POST', `/api/resource/${encodeURIComponent(doctype)}`, doc)
    return res.data
  }

  /** Update a permitted supporting record. */
  async updateSupportingRecord<T = Record<string, unknown>> (doctype: string, name: string, doc: Record<string, unknown>): Promise<T> {
    const res = await this.#request<DocumentEnvelope<T>>('PUT', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, doc)
    return res.data
  }

  /** Delete a permitted supporting record. */
  async deleteSupportingRecord (doctype: string, name: string): Promise<void> {
    await this.#request('DELETE', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`)
  }

  /** Create supporting records sequentially; this is not a domain transaction. */
  async bulkCreateSupportingRecords<T = Record<string, unknown>> (items: Array<BulkDocItem<T>>): Promise<Array<BulkDocResult<T>>> {
    const results: Array<BulkDocResult<T>> = []
    for (const [index, item] of items.entries()) {
      try {
        const data = await this.createSupportingRecord<T>(item.doctype, item.doc ?? {})
        results.push({
          index,
          doctype: item.doctype,
          success: true,
          data,
        })
      } catch (error) {
        results.push({
          index,
          doctype: item.doctype,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    return results
  }

  /** Update supporting records sequentially; this is not a domain transaction. */
  async bulkUpdateSupportingRecords<T = Record<string, unknown>> (items: Array<BulkDocItem<T> & { name: string }>): Promise<Array<BulkDocResult<T>>> {
    const results: Array<BulkDocResult<T>> = []
    for (const [index, item] of items.entries()) {
      try {
        const data = await this.updateSupportingRecord<T>(item.doctype, item.name, item.doc ?? {})
        results.push({
          index,
          doctype: item.doctype,
          name: item.name,
          success: true,
          data,
        })
      } catch (error) {
        results.push({
          index,
          doctype: item.doctype,
          name: item.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    return results
  }

  /** Delete supporting records sequentially; this is not a domain transaction. */
  async bulkDeleteSupportingRecords (items: Array<{ doctype: string; name: string }>): Promise<Array<BulkDocResult<void>>> {
    const results: Array<BulkDocResult<void>> = []
    for (const [index, item] of items.entries()) {
      try {
        await this.deleteSupportingRecord(item.doctype, item.name)
        results.push({
          index,
          doctype: item.doctype,
          name: item.name,
          success: true,
        })
      } catch (error) {
        results.push({
          index,
          doctype: item.doctype,
          name: item.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    return results
  }

  /** Upload a file attachment to the connected site. */
  async uploadFile (file: File | Blob, filename?: string): Promise<FileRef> {
    const formData = new FormData()
    formData.append('file', file, filename || ('name' in file && typeof file.name === 'string' ? file.name : 'file'))
    return this.#requestMultipart<FileRef>('/api/upload', formData)
  }

  /** Build a site-scoped file URL. */
  getFileUrl (path: string): string {
    const clean = path.replace(/^\/+/, '')
    return `${this.#basePath()}/files/${clean}`
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

  async #request<T> (method: string, path: string, body?: unknown, signal?: AbortSignal, extraHeaders: Record<string, string> = {}): Promise<T> {
    const url = `${this.#basePath()}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }
    const authHeader = await this.#resolveAuthHeader()
    if (authHeader) headers.Authorization = authHeader

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.#config.timeout)
    const relayAbort = () => controller.abort(signal?.reason)
    if (signal?.aborted) relayAbort()
    else signal?.addEventListener('abort', relayAbort, { once: true })

    try {
      const response = await this.#fetchImpl(url, {
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
      signal?.removeEventListener('abort', relayAbort)
    }
  }

  async #requestScoped<T> (scope: BusinessScope, method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    validateBusinessScope(scope)
    if (body !== undefined && body !== null && typeof body === 'object' && !Array.isArray(body)) {
      const requestedScope = (body as { business_scope?: unknown }).business_scope
      if (requestedScope !== undefined && (!isContract<BusinessScope>('BusinessScope', requestedScope) || !sameBusinessScope(scope, requestedScope))) {
        throw new TypeError('Kora request scope does not match scoped client')
      }
    }
    const url = `${this.#basePath()}${path}`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    applyBusinessScopeHeaders(headers, scope)
    const authHeader = await this.#resolveAuthHeader()
    if (authHeader) headers.Authorization = authHeader
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.#config.timeout)
    const relayAbort = () => controller.abort(signal?.reason)
    if (signal?.aborted) relayAbort()
    else signal?.addEventListener('abort', relayAbort, { once: true })
    try {
      const response = await this.#fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal })
      const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
      if (!response.ok) {
        const envelope = data && typeof data === 'object' ? data as { error?: unknown } : {}
        const error = envelope.error && typeof envelope.error === 'object' ? envelope.error as { message?: unknown } : {}
        throw new KoraError(typeof envelope.error === 'string' ? envelope.error : typeof error.message === 'string' ? error.message : response.statusText, response.status, envelope.error)
      }
      if (response.status !== 204 && data === undefined) throw new TypeError('Malformed successful Kora response')
      return data as T
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', relayAbort)
    }
  }

  async #getCatalog (scope: BusinessScope, signal?: AbortSignal): Promise<ApplicationCatalog> {
    const response = await this.#requestScoped<{ data?: unknown }>(scope, 'GET', '/api/v2/modules/catalog', undefined, signal)
    const catalog = decodeContract<ApplicationCatalog>('ApplicationCatalog', response.data)
    assertCatalogScope(scope, catalog)
    return catalog
  }

  async #queryPublished (scope: BusinessScope, catalog: ApplicationCatalog, owner: string, name: string, request: PublishedQueryRequest, signal?: AbortSignal): Promise<QueryResult> {
    assertCatalogScope(scope, catalog)
    decodeContract<PublishedQueryRequest>('PublishedQueryRequest', request)
    const query = catalog.published_queries.find(item => item.owner_module_id === owner && item.name === name)
    if (!query) throw new TypeError('Published query is not present in the authorized catalog')
    validateCatalogSchema(catalog, query.input_schema, request.input)
    const result = await this.#requestCatalogRoute<{ data?: unknown }>(scope, query.route, 'POST', request, signal)
    const page = decodeContract<QueryResult>('QueryResult', result.data)
    validateCatalogSchema(catalog, query.output_schema, page.data)
    return page
  }

  async #getProjection (scope: BusinessScope, catalog: ApplicationCatalog, owner: string, id: string, signal?: AbortSignal): Promise<QueryResult> {
    assertCatalogScope(scope, catalog)
    const projection = catalog.published_projections.find(item => item.owner_module_id === owner && item.id === id)
    if (!projection) throw new TypeError('Published projection is not present in the authorized catalog')
    const result = await this.#requestCatalogRoute<{ data?: unknown }>(scope, projection.route, 'GET', undefined, signal)
    const page = decodeContract<QueryResult>('QueryResult', result.data)
    validateCatalogSchema(catalog, projection.output_schema, page.data)
    return page
  }

  async #executeOperation (scope: BusinessScope, catalog: ApplicationCatalog, operationRef: string, command: ExecutePublishedOperation, signal?: AbortSignal): Promise<OperationReceipt> {
    assertCatalogScope(scope, catalog)
    decodeContract<ExecutePublishedOperation>('ExecutePublishedOperation', command)
    const operation = catalog.published_operations.find(item => item.operation_ref === operationRef)
    if (!operation || operation.availability !== 'available') throw new TypeError('Published operation is not available in the authorized catalog')
    if (!sameSchemaRef(command.input_schema, operation.input_schema)) throw new TypeError('Published operation input schema does not match the catalog')
    validateCatalogSchema(catalog, operation.input_schema, command.input)
    const envelope = await this.#requestScoped<{ data?: unknown }>(scope, 'POST', `/api/v2/modules/operations/${encodeURIComponent(operationRef)}/execute`, command, signal)
    const receipt = decodeContract<OperationReceipt>('OperationReceipt', envelope.data)
    validateOperationReceipt(scope, operationRef, receipt)
    if (receipt.status === 'completed') {
      if (!sameSchemaRef(receipt.output_schema, operation.output_schema)) throw new TypeError('Operation receipt output schema does not match the catalog')
      validateCatalogSchema(catalog, operation.output_schema, receipt.output)
    }
    return receipt
  }

  async #getExecution (scope: BusinessScope, catalog: ApplicationCatalog, executionId: string, signal?: AbortSignal): Promise<OperationReceipt> {
    assertCatalogScope(scope, catalog)
    const envelope = await this.#requestScoped<{ data?: unknown }>(scope, 'GET', `/api/v2/module-executions/${encodeURIComponent(executionId)}`, undefined, signal)
    const receipt = decodeContract<OperationReceipt>('OperationReceipt', envelope.data)
    const operation = catalog.published_operations.find(item => item.operation_ref === receipt.operation_ref)
    if (!operation) throw new TypeError('Operation receipt is outside the authorized catalog')
    validateOperationReceipt(scope, operation.operation_ref, receipt)
    if (receipt.status === 'completed') {
      if (!sameSchemaRef(receipt.output_schema, operation.output_schema)) throw new TypeError('Operation receipt output schema does not match the catalog')
      validateCatalogSchema(catalog, operation.output_schema, receipt.output)
    }
    return receipt
  }

  async #lookupExecution (scope: BusinessScope, catalog: ApplicationCatalog, lookup: LookupPublishedOperation, signal?: AbortSignal): Promise<OperationReceipt> {
    assertCatalogScope(scope, catalog)
    decodeContract<LookupPublishedOperation>('LookupPublishedOperation', lookup)
    const operation = catalog.published_operations.find(item => item.operation_ref === lookup.operation_ref)
    if (!operation) throw new TypeError('Operation is not present in the authorized catalog')
    const envelope = await this.#requestScoped<{ data?: unknown }>(scope, 'POST', '/api/v2/module-executions/lookup', lookup, signal)
    const receipt = decodeContract<OperationReceipt>('OperationReceipt', envelope.data)
    validateOperationReceipt(scope, lookup.operation_ref, receipt)
    if (receipt.status === 'completed') {
      if (!sameSchemaRef(receipt.output_schema, operation.output_schema)) throw new TypeError('Operation receipt output schema does not match the catalog')
      validateCatalogSchema(catalog, operation.output_schema, receipt.output)
    }
    return receipt
  }

  async #requestCatalogRoute<T> (scope: BusinessScope, route: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!route.startsWith('/api/v1/modules/') || route.includes('..') || route.includes('?') || route.includes('#')) throw new TypeError('Catalog contains an invalid published route')
    return this.#requestScoped<T>(scope, method, route, body, signal)
  }

  async #requestMultipart<T> (path: string, body: FormData): Promise<T> {
    const url = `${this.#basePath()}${path}`
    const headers: Record<string, string> = {}
    const authHeader = await this.#resolveAuthHeader()
    if (authHeader) headers.Authorization = authHeader

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.#config.timeout)

    try {
      const response = await this.#fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : data.error?.message || response.statusText
        throw new KoraError(errMsg, response.status, data.error)
      }
      return data.data as T
    } finally {
      clearTimeout(timer)
    }
  }

  async #resolveAuthHeader (): Promise<string | undefined> {
    if (this.#config.authHeader) return this.#config.authHeader
    if (this.#config.authProvider) {
      const value = await this.#config.authProvider()
      if (value) return value
    }
    if (this.#config.token) return `Bearer ${this.#config.token}`
    return undefined
  }

  #basePath (): string {
    return `${this.#config.baseUrl}/s/${encodeURIComponent(this.#config.siteName)}`
  }
}

export interface KoraScopedClient {
  readonly scope: BusinessScope
  request<T = unknown>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T>
  catalog(signal?: AbortSignal): Promise<ApplicationCatalog>
  queryPublished(catalog: ApplicationCatalog, owner: string, name: string, request: PublishedQueryRequest, signal?: AbortSignal): Promise<QueryResult>
  getProjection(catalog: ApplicationCatalog, owner: string, id: string, signal?: AbortSignal): Promise<QueryResult>
  executeOperation(catalog: ApplicationCatalog, operationRef: string, command: ExecutePublishedOperation, signal?: AbortSignal): Promise<OperationReceipt>
  getExecution(catalog: ApplicationCatalog, executionId: string, signal?: AbortSignal): Promise<OperationReceipt>
  lookupExecution(catalog: ApplicationCatalog, lookup: LookupPublishedOperation, signal?: AbortSignal): Promise<OperationReceipt>
}

function validateBusinessScope (scope: BusinessScope): void {
  if (!isContract<BusinessScope>('BusinessScope', scope)) throw new TypeError('Invalid Kora BusinessScope')
}

function applyBusinessScopeHeaders (headers: Record<string, string>, scope: BusinessScope): void {
  if (scope.kind === 'legal_entity') headers['X-Kora-Legal-Entity-ID'] = scope.legal_entity_id
}

function sameBusinessScope (left: BusinessScope, right: BusinessScope): boolean {
  return left.tenant_id === right.tenant_id && left.kind === right.kind &&
    (left.kind === 'legal_entity' && right.kind === 'legal_entity' ? left.legal_entity_id === right.legal_entity_id : left.kind === 'tenant' && right.kind === 'tenant')
}

function assertCatalogScope (scope: BusinessScope, catalog: ApplicationCatalog): void {
  decodeContract<ApplicationCatalog>('ApplicationCatalog', catalog)
  if (!sameBusinessScope(scope, catalog.business_scope)) throw new TypeError('Application catalog scope does not match scoped client')
}

function sameSchemaRef (left: SchemaRef, right: SchemaRef): boolean {
  return left.id === right.id && left.version === right.version
}

function validateCatalogSchema (catalog: ApplicationCatalog, ref: SchemaRef, value: unknown): void {
  const matches = catalog.schemas.filter(document => sameSchemaRef(document.ref, ref))
  if (matches.length !== 1) throw new TypeError(`Catalog is missing one exact schema document: ${ref.id}@${ref.version}`)
  assertPublishedSchema(matches[0]?.schema, value)
}

function validateOperationReceipt (scope: BusinessScope, operationRef: string, receipt: OperationReceipt): void {
  if (receipt.operation_ref !== operationRef || !sameBusinessScope(receipt.business_scope, scope)) {
    throw new TypeError('Operation receipt identity does not match the requested scope and operation')
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

function isRequestPage (value: unknown, itemType: 'RequestView' | 'RequestHistoryEntry'): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const page = value as { items?: unknown; next_cursor?: unknown }
  return Array.isArray(page.items) && page.items.every(item => isContract(itemType, item)) &&
    (page.next_cursor === undefined || typeof page.next_cursor === 'string')
}
