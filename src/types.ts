/** Configuration for creating a KoraClient */
export interface KoraClientConfig {
  /** Base URL of the Kora site (e.g., https://myapp.kora.dev) */
  baseUrl: string
  /** Bearer token for authentication */
  token: string
  /** Request timeout in ms (default: 30000) */
  timeout?: number
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
