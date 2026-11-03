# @kora/extension-sdk

TypeScript SDK for extension clients using Kora's published, actor-scoped contracts.

The SDK:

- does not depend on a UI framework
- can be used by extension hosts, Node services and scripts
- transports scope and credentials while Engine owns authorization, provider selection and business invariants

## Architecture and contract migration

The [architecture contract notes](docs/architecture-contracts.md) track the Engine-owned wire boundary. Generated Engine v2 wire types and runtime validators are exported from the SDK root with a development-snapshot base revision and artifact digest. Typed request and workflow methods are available; use `getCapabilities()` to check tenant support because older Engines and tenants without assembled services may not support every endpoint. The Engine remains responsible for authorization and domain eligibility.

## Installation

```bash
npm install @kora/extension-sdk
```

## What It Can Do

The extension surface exposes immutable business scopes, the actor-filtered catalog, published queries/projections, published domain operations, execution receipts and lookup by the original operation/idempotency key. Supporting-record CRUD helpers remain available only where Engine explicitly permits them; they do not grant access to module-owned business resources.

## Configuration

```ts
import { KoraClient } from '@kora/extension-sdk'

const kora = new KoraClient({
  baseUrl: 'https://myapp.kora.dev',
  siteName: 'acme',
  authProvider: async () => `Bearer ${await getExtensionTokenFromSecretStore()}`,
})
```

You can also inject a custom `fetch` implementation for environments that do not expose a global `fetch`.

## Supporting-record CRUD

These methods are only for explicitly permitted supporting records. Module-owned business resources must be read through published queries/projections and changed through owner-published operations. Bulk helpers make sequential requests; they are neither atomic nor a substitute for a domain operation.

```ts
const customer = await kora.getSupportingRecord<{ name: string; email: string }>('Customer', 'CUST-0001')

const customers = await kora.listSupportingRecords<{ name: string; full_name: string }>('Customer', {
  limit: 20,
  offset: 0,
  filters: [['status', '=', 'Active']],
  orderBy: 'modified DESC',
})

await kora.createSupportingRecord('Feedback', {
  title: 'Great product',
  rating: 5,
})

await kora.updateSupportingRecord('Feedback', 'FDB-0001', {
  rating: 4,
})

await kora.deleteSupportingRecord('Feedback', 'FDB-0001')

const bulkCreated = await kora.bulkCreateSupportingRecords([
  { doctype: 'Feedback', doc: { title: 'Great product', rating: 5 } },
  { doctype: 'Feedback', doc: { title: 'Needs work', rating: 2 } },
])

const bulkUpdated = await kora.bulkUpdateSupportingRecords([
  { doctype: 'Feedback', name: 'FDB-0001', doc: { rating: 4 } },
])

const bulkDeleted = await kora.bulkDeleteSupportingRecords([
  { doctype: 'Feedback', name: 'FDB-0002' },
])
```

Use `uploadFile()` for image, audio, and attachment inputs. Use `getFileUrl()` when rendering previews or links.

## Error Handling

Requests throw `KoraError` when the server returns a non-2xx response.

```ts
try {
  await kora.getSupportingRecord('Order', 'ORD-0001')
} catch (err) {
  if (err instanceof KoraError) {
    console.error(err.status, err.message)
  }
}
```

## Human requests

The SDK exposes the Engine v2 request contract with generated TypeScript types and runtime validation. The Engine currently enables subject-free direct user tasks for verified human tenant users; extension/service credentials, approvals, and subject-bound requests are denied until their domain policy is assembled.

```ts
import { KoraClient, type SubmitRequest } from '@kora/extension-sdk'

const command: SubmitRequest = {
  meta: { idempotency_key: crypto.randomUUID() },
  kind: 'task',
  title: 'Review this item',
  message: 'Please complete the review.',
  assignment: { mode: 'any', assignees: [{ kind: 'user', id: 'reviewer' }] },
}

const created = await kora.submitRequest(command)
const inbox = await kora.listRequests({
  page: { limit: 25 }, view: 'needs_action', overdue_only: false,
})
```

The server derives requester identity from authentication, filters every inbox projection, and rechecks assignment eligibility and revision when recording a response. These methods require the Engine v2 request routes.

## Published module data and operations

Bind a client to the actor's selected canonical scope, read the actor-filtered catalog, then use the exact published query or operation schema and route. The server rechecks authorization and resolves the provider. Keep the same idempotency key when recovering an uncertain operation; inspect or look up its receipt before deciding what to do next.

```ts
const scoped = kora.withScope({ tenant_id: 'tenant-1', kind: 'legal_entity', legal_entity_id: 'entity-1' })
const catalog = await scoped.catalog()
const query = catalog.published_queries.find((item) => item.name === 'open_orders')
if (!query) throw new Error('Open orders are not published for this scope')

const page = await scoped.queryPublished(catalog, query.owner_module_id, query.name, {
  input: {},
  limit: query.page_limit,
})
// Keep next_cursor, snapshot_token, source_revision, as_of and freshness with the data.

const operation = catalog.published_operations.find((item) => item.operation === 'issue_invoice')
if (!operation || operation.availability !== 'available') throw new Error('Invoice issue is unavailable')
const idempotencyKey = crypto.randomUUID() // persist this key with the intent before sending
const receipt = await scoped.executeOperation(catalog, operation.operation_ref, {
  meta: { idempotency_key: idempotencyKey },
  input_schema: operation.input_schema,
  input: { order_ref: { provider_id: 'sales', resource_type: 'order', id: 'ORD-1', scope: scoped.scope } },
})
```

`completed` describes that operation's result. Payment, fulfillment and other downstream workflow outcomes can have separate receipts and statuses. The SDK never chooses an internal or external provider.

## Extension credentials and authorization

Use a tenant extension bearer credential issued by the Engine's extension credential administration flow. Keep it in the extension host's secret store and supply it through `authProvider`; never put a management credential or provider secret in the SDK config. Rotate or revoke the extension credential through the same Engine administration surface. Once revoked, requests fail with the server's typed `KoraError.code` and HTTP status.

Engine evaluates the extension's published-operation grants on every catalog, query, execution and receipt request. A catalog entry describes availability but grants no authority by itself. The SDK never sends a caller module ID, provider choice or capability lease. `BusinessRef` values retain `provider_id`, `resource_type`, `id` and the full `scope` when passed as schema-validated operation input.

On a network timeout, keep the original idempotency key and call `lookupExecution({ operation_ref, idempotency_key })`. The lookup does not dispatch work. `outcome_unknown` is a receipt state that needs reconciliation; it is not a rejection and the SDK does not retry it under a new key. `KoraError.code` preserves Engine distinctions such as `permission.denied` and `module.operation_unavailable`.

The executable extension-token suite in [`examples/extension-conformance.ts`](examples/extension-conformance.ts) exercises catalog, published query, operation, a deliberately lost response and receipt recovery, plus denied private CRUD, wrong entity, forged operation and revoked credential cases. The optional second operation reference lets a fresh fixture run the same SDK signature against the second configured provider. Configure its isolated Engine fixture with the variables used by `.github/workflows/extension-conformance.yml`; never use production credentials for this suite.

## Versioning

This package follows semantic versioning.

## License

MIT
