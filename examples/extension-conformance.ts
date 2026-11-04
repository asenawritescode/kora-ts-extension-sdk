import { KoraClient, KoraError, type BusinessScope, type OperationReceipt } from '../src/index.js'

declare const process: { env: Record<string, string | undefined> }

const env = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}
const scope: BusinessScope = process.env.KORA_LEGAL_ENTITY_ID
  ? { tenant_id: env('KORA_TENANT_ID'), kind: 'legal_entity', legal_entity_id: process.env.KORA_LEGAL_ENTITY_ID }
  : { tenant_id: env('KORA_TENANT_ID'), kind: 'tenant' }
const operationInput = JSON.parse(env('KORA_OPERATION_INPUT_JSON')) as unknown
const operationInputRef = { id: env('KORA_OPERATION_INPUT_SCHEMA_ID'), version: Number(env('KORA_OPERATION_INPUT_SCHEMA_VERSION')) }
const client = new KoraClient({
  baseUrl: env('KORA_BASE_URL'),
  siteName: env('KORA_SITE_NAME'),
  authProvider: () => `Bearer ${env('KORA_EXTENSION_TOKEN')}`,
})
const scoped = client.withScope(scope)
const catalog = await scoped.catalog()
const operationRef = env('KORA_OPERATION_REF')
const operation = catalog.published_operations.find(item => item.operation_ref === operationRef)
if (!operation) throw new Error('Configured operation is not present in the extension actor catalog')
const queryOwner = env('KORA_QUERY_OWNER_MODULE')
const queryName = env('KORA_QUERY_NAME')
const query = catalog.published_queries.find(item => item.owner_module_id === queryOwner && item.name === queryName)
if (!query) throw new Error('Configured query is not present in the extension actor catalog')
const queryResult = await scoped.queryPublished(catalog, queryOwner, queryName, { input: JSON.parse(env('KORA_QUERY_INPUT_JSON')) as unknown })
if (!['fresh', 'stale', 'unknown', 'incomplete'].includes(queryResult.freshness)) throw new Error('Query result has an invalid freshness value')

const idempotencyKey = env('KORA_OPERATION_IDEMPOTENCY_KEY')
let responseDropped = false
const lostResponseClient = new KoraClient({
  baseUrl: env('KORA_BASE_URL'),
  siteName: env('KORA_SITE_NAME'),
  authProvider: () => `Bearer ${env('KORA_EXTENSION_TOKEN')}`,
  fetch: async (input, init) => {
    const response = await fetch(input, init)
    if (!responseDropped && String(input).includes('/api/v2/modules/operations/') && String(input).endsWith('/execute')) {
      responseDropped = true
      throw new DOMException('Conformance test intentionally dropped the first operation response', 'AbortError')
    }
    return response
  },
})
const lostResponseScope = lostResponseClient.withScope(scope)
const lostCatalog = await lostResponseScope.catalog()
try {
  await lostResponseScope.executeOperation(lostCatalog, operationRef, {
    meta: { idempotency_key: idempotencyKey },
    input_schema: operationInputRef,
    input: operationInput,
  })
  throw new Error('Conformance fetch did not drop the operation response')
} catch (error) {
  if (error instanceof KoraError) throw error
  if (!(error instanceof DOMException) || error.name !== 'AbortError') throw error
}
const recovered = await lostResponseScope.lookupExecution(lostCatalog, { operation_ref: operationRef, idempotency_key: idempotencyKey })
assertReceipt(recovered, scope, operationRef)

// A second provider operation uses the same public method and receipt shape.
// Engine resolves the provider from its trusted binding; the test supplies only
// a published operation ref and the documented input contract.
const secondProviderOperationRef = env('KORA_SECOND_PROVIDER_OPERATION_REF')
const second = lostCatalog.published_operations.find(item => item.operation_ref === secondProviderOperationRef)
if (!second) throw new Error('Second provider operation is not published to this extension')
const secondReceipt = await lostResponseScope.executeOperation(lostCatalog, secondProviderOperationRef, {
  meta: { idempotency_key: env('KORA_SECOND_PROVIDER_IDEMPOTENCY_KEY') },
  input_schema: second.input_schema,
  input: JSON.parse(env('KORA_SECOND_PROVIDER_INPUT_JSON')) as unknown,
})
assertReceipt(secondReceipt, scope, secondProviderOperationRef)

async function expectDenied (label: string, request: Promise<unknown>, expected: { codes?: string[]; statuses: number[] }): Promise<void> {
  try {
    await request
  } catch (error) {
    if (error instanceof KoraError && expected.statuses.includes(error.status) && (!expected.codes || expected.codes.includes(error.code ?? ''))) return
    throw new Error(`${label} returned an unexpected error`, { cause: error })
  }
  throw new Error(`${label} unexpectedly succeeded`)
}

const forgedOperationRef = env('KORA_FORGED_OPERATION_REF')
await expectDenied('forged owner operation', scoped.request('POST', `/api/v2/modules/operations/${encodeURIComponent(forgedOperationRef)}/execute`, {
  meta: { idempotency_key: 'forged-operation-key' }, input_schema: operationInputRef, input: operationInput,
}), { statuses: [403, 404] })

const deniedScope: BusinessScope = {
  tenant_id: env('KORA_TENANT_ID'), kind: 'legal_entity', legal_entity_id: env('KORA_DENIED_LEGAL_ENTITY_ID'),
}
await expectDenied('wrong entity scope', client.withScope(deniedScope).catalog(), { codes: ['permission.denied'], statuses: [403] })

// The legacy record route still returns a plain 403 error envelope.  The
// status is the authoritative denial signal here; do not require a
// canonical error code from that superseded transport.
await expectDenied('private record CRUD', scoped.request('POST', env('KORA_PRIVATE_RECORD_PATH'), JSON.parse(env('KORA_PRIVATE_RECORD_JSON')) as unknown), { statuses: [403] })

const revokedClient = new KoraClient({
  baseUrl: env('KORA_BASE_URL'), siteName: env('KORA_SITE_NAME'),
  authProvider: () => `Bearer ${env('KORA_REVOKED_EXTENSION_TOKEN')}`,
})
await expectDenied('revoked extension token', revokedClient.withScope(scope).catalog(), { codes: ['auth.unauthenticated', 'auth.invalid_token'], statuses: [401, 403] })

console.log(JSON.stringify({ recovered_status: recovered.status, operation_ref: operationRef, response_dropped: responseDropped }))

function assertReceipt (receipt: OperationReceipt, expectedScope: BusinessScope, expectedOperation: string): void {
  if (receipt.operation_ref !== expectedOperation || receipt.business_scope.tenant_id !== expectedScope.tenant_id || receipt.business_scope.kind !== expectedScope.kind) {
    throw new Error('Operation receipt scope or operation does not match the request')
  }
  if (expectedScope.kind === 'legal_entity' && (receipt.business_scope.kind !== 'legal_entity' || receipt.business_scope.legal_entity_id !== expectedScope.legal_entity_id)) {
    throw new Error('Operation receipt legal entity does not match the request')
  }
  if (!['accepted', 'running', 'completed', 'rejected', 'conflict', 'failed', 'outcome_unknown'].includes(receipt.status)) {
    throw new Error('Operation receipt status is unsupported')
  }
}
