/** Configuration for creating a KoraClient */
export interface KoraClientConfig {
  /** Base URL of the Kora site (e.g., https://myapp.kora.dev) */
  baseUrl: string
  /** Kora site name or hostname segment used in request paths. */
  siteName: string
  /** Bearer token for authentication, or an auth header provider. */
  token?: string
  /** Custom auth header value, overriding token when provided. */
  authHeader?: string
  /** Provide auth headers dynamically per request. */
  authProvider?: () => Promise<string | undefined> | string | undefined
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Optional custom fetch implementation for non-browser runtimes. */
  fetch?: typeof fetch
}

/** High-level site context for a connected Kora instance. */
export interface SiteContext {
  baseUrl: string
  siteName: string
  authHeader?: string
  timeout?: number
}

/** DocType definition mirrored from the Kora engine config model. */
export interface DocType {
  name: string
  resource_name?: string
  module: string
  is_submittable: boolean
  is_child_table: boolean
  is_single: boolean
  track_changes: boolean
  title_field: string
  search_fields: string
  sort_field: string
  sort_order: string
  description: string
  fields: Field[]
  doc_constraints?: DocConstraint[]
  public_access?: PublicAccess
}

/** Public-access configuration for a DocType. */
export interface PublicAccess {
  enabled: boolean
  list: boolean
  read: boolean
  fields: string[]
  filters: PublicFilter[]
  sort_field: string
  sort_order: string
  max_limit: number
  cache_max_age: number
}

/** Server-owned public filter. */
export interface PublicFilter {
  field: string
  op: string
  value: unknown
}

/** A document field definition. */
export interface Field {
  fieldname: string
  fieldtype: string
  label: string
  options?: string
  reqd?: boolean
  unique?: boolean
  default?: string
  hidden?: boolean
  read_only?: boolean
  bold?: boolean
  in_list_view?: boolean
  in_standard_filter?: boolean
  search_index?: boolean
  description?: string
  depends_on?: string
  mandatory_depends_on?: string
  constraints?: Constraint[]
  renamed_from?: string
  linked_field?: string
  computed?: string
  dependency_scope?: string
  accept?: string
}

/** Field constraint definition. */
export interface Constraint {
  type: string
  value?: unknown
  values?: string[]
  pattern?: string
  message: string
  condition?: string
  scope?: string
}

/** Doc-level constraint definition. */
export interface DocConstraint {
  type: string
  predicate: string
  condition?: string
  message: string
}

/** View definition mirrored from the Kora engine config model. */
export interface View {
  name: string
  route: string
  type: string
  layout: string
  label: string
  module: string
  source_doctype?: string
  components: ViewComponent[]
  public_access?: ViewPublicAccess
}

/** Component in a view tree. */
export interface ViewComponent {
  id: string
  type: string
  region: string
  label?: string
  source_doctype?: string
  data?: string
  bindings?: Record<string, string>
  filters?: ViewFilter[]
  actions?: ViewAction[]
  rules?: ViewRule[]
  components?: ViewComponent[]
  desktop_columns?: string[]
  mobile_columns?: string[]
  position: number
  span?: number
}

/** View action definition. */
export interface ViewAction {
  id: string
  trigger: string
  type: string
  config?: Record<string, unknown>
}

/** View rule definition. */
export interface ViewRule {
  target: string
  condition: ViewCondition
}

/** Structured condition for a view rule/filter. */
export interface ViewCondition {
  field: string
  op: string
  value: unknown
}

/** View filter definition. */
export interface ViewFilter {
  field: string
  op: string
  value: unknown
}

/** View public-access configuration. */
export interface ViewPublicAccess {
  enabled: boolean
  components: string[]
  allow_mutations: boolean
}

/** Generic document shape for UI and backend clients. */
export interface Document<TFields = Record<string, unknown>, TChild = Record<string, unknown>> {
  name?: string
  doctype: string
  owner?: string
  creation?: string
  modified?: string
  modified_by?: string
  doc_status?: number
  idx?: number
  fields: TFields
  children?: Record<string, TChild[]>
  attachments?: FileRef[]
}

/** Query options for document reads/searches. */
export interface Query {
  filters?: Record<string, unknown> | Array<[string, string, unknown]>
  search?: string
  fields?: string[]
  limit?: number
  offset?: number
  orderBy?: string
  groupBy?: string
}

/** Result wrapper for mutations. */
export interface MutationResult<T = Record<string, unknown>> {
  data?: T
  warnings?: string[]
  errors?: Array<{ field?: string; message: string; code?: string }>
  workflow?: WorkflowResult
}

/** Bulk operation item input. */
export interface BulkDocItem<T = Record<string, unknown>> {
  doctype: string
  name?: string
  doc?: T
}

/** Bulk operation result per item. */
export interface BulkDocResult<T = Record<string, unknown>> {
  index: number
  doctype: string
  name?: string
  success: boolean
  data?: T
  error?: string
}

/** Workflow definition model. */
export interface Workflow {
  name: string
  doctype: string
  states: WorkflowState[]
  transitions: WorkflowTransition[]
}

export interface WorkflowState {
  name: string
  label?: string
  is_default?: boolean
  is_final?: boolean
}

export interface WorkflowTransition {
  action: string
  from: string
  to: string
  allowed_roles?: string[]
}

export interface WorkflowResult {
  action?: string
  from?: string
  to?: string
  triggered?: boolean
}

/** File reference returned by upload and attachment flows. */
export interface FileRef {
  path: string
  filename: string
  mimeType?: string
  size?: number
  url?: string
}

/** Common document response shape used by Kora APIs. */
export interface DocumentEnvelope<T = Record<string, unknown>> {
  data: T
  meta?: Record<string, unknown>
}

/** Common list response shape used by Kora APIs. */
export interface ListEnvelope<T = Record<string, unknown>> {
  data: T[]
  meta?: {
    total?: number
    doctype?: string
    [key: string]: unknown
  }
}

/** Query options for document list endpoints. */
export interface ListQuery {
  limit?: number
  offset?: number
  filters?: Record<string, unknown> | Array<[string, string, unknown]>
  orderBy?: string
  fields?: string[]
  search?: string
  groupBy?: string
}

/** Stored script record */
export interface ScriptRecord {
  name: string
  script_type: ScriptType
  doctype?: string
  event?: string
  method_path?: string
  workflow_action?: string
  schedule?: string
  script: string
  priority: number
  is_active: boolean
  run_as?: string
  timeout_ms: number
  description?: string
  site: string
  created_at: string
  updated_at: string
  created_by: string
}

/** Request to create a script */
export interface ScriptCreateRequest {
  name: string
  script_type: ScriptType
  doctype?: string
  event?: string
  method_path?: string
  workflow_action?: string
  schedule?: string
  script: string
  priority?: number
  is_active?: boolean
  run_as?: string
  timeout_ms?: number
  description?: string
}

/**
 * Request to update a script.
 * All fields are optional — only provided fields are applied, matching the Go SDK's pointer-based
 * ScriptUpdateRequest semantics.
 */
export interface ScriptUpdateRequest {
  script_type?: ScriptType
  doctype?: string
  event?: string
  method_path?: string
  workflow_action?: string
  schedule?: string
  priority?: number
  is_active?: boolean
  run_as?: string
  timeout_ms?: number
  script?: string
  description?: string
}

/** Script execution log entry */
export interface ScriptExecution {
  id: string
  script_name: string
  script_type: string
  doctype?: string
  docname?: string
  event?: string
  trigger_user: string
  duration_ms: number
  status: 'success' | 'error'
  error_message?: string
  logged_at: string
}

/** Input to the script runner */
export interface ExecuteRequest {
  script: string
  script_type: string
  script_name: string
  doctype?: string
  event?: string
  user: string
  user_roles: string[]
  site: string
  document: Record<string, unknown>
  old_document?: Record<string, unknown>
  timeout?: number
  /** Provider bridges the JS runtime to the Kora engine. If omitted, engine calls return safe defaults. */
  provider?: KoraProvider
}

/** Output from the script runner */
export interface ExecuteResult {
  document?: Record<string, unknown>
  result?: unknown
  modified: boolean
  duration_ms: number
  logs: LogEntry[]
}

/** Log entry from script execution */
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  time: string
}

/** HTTP request from a script */
export interface HTTPRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

/** HTTP response to a script */
export interface HTTPResponse {
  status: number
  status_text: string
  headers: Record<string, string>
  body: Uint8Array
}

/**
 * KoraProvider bridges the JavaScript runtime to the Kora engine.
 * When used with the script runner, it provides access to engine APIs like getDoc, saveDoc, etc.
 */
export interface KoraProvider {
  /** Get a document by doctype and name */
  getDoc: (doctype: string, name: string) => Promise<Record<string, unknown> | null>
  /** Get a list of documents matching filters */
  getList: (doctype: string, filters?: Record<string, unknown>) => Promise<Record<string, unknown>[]>
  /** Save (insert or update) a document */
  saveDoc: (doctype: string, doc: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** Delete a document */
  deleteDoc: (doctype: string, name: string) => Promise<void>
  /** Get the authenticated user's info */
  getUser: () => Promise<Record<string, unknown>>
  /** Make an HTTP request */
  httpRequest: (req: HTTPRequest) => Promise<HTTPResponse>
}

/** Webhook extension record */
export interface ExtensionRecord {
  name: string
  display_name: string
  description?: string
  endpoint_url: string
  is_active: boolean
  subscriptions: string[]
  api_permissions: string[]
  access_token?: string
  site: string
  created_at: string
  updated_at: string
  total_deliveries: number
  success_deliveries: number
  failed_deliveries: number
  last_delivery_at?: string
  consecutive_failures: number
}

/** Request to create an extension */
export interface ExtensionCreateRequest {
  name: string
  display_name: string
  description?: string
  endpoint_url: string
  subscriptions?: string[]
  api_permissions?: string[]
}

/** Webhook delivery record */
export interface DeliveryRecord {
  id: string
  extension_name: string
  event_type: string
  status: 'pending' | 'success' | 'failed' | 'retrying'
  status_code: number
  request_body?: string
  response_body?: string
  error_message?: string
  duration_ms: number
  created_at: string
}

/** Event type constants matching the Go SDK's lifecycle hook points */
export const EventType = {
  BEFORE_INSERT: 'before_insert',
  AFTER_INSERT: 'after_insert',
  BEFORE_SAVE: 'before_save',
  AFTER_SAVE: 'after_save',
  BEFORE_DELETE: 'before_delete',
  AFTER_DELETE: 'after_delete',
  BEFORE_SUBMIT: 'before_submit',
  AFTER_SUBMIT: 'after_submit',
  BEFORE_CANCEL: 'before_cancel',
  AFTER_CANCEL: 'after_cancel',
  VALIDATE: 'validate',
  COMPUTED: 'computed',
} as const

export type EventType = (typeof EventType)[keyof typeof EventType]

/** Script type constants matching the Go SDK's script classification */
export const ScriptType = {
  DOC_EVENT: 'doc_event',
  API_METHOD: 'api_method',
  WORKFLOW_ACTION: 'workflow_action',
  SCHEDULED: 'scheduled',
} as const

export type ScriptType = (typeof ScriptType)[keyof typeof ScriptType]
