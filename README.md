# @kora/extension-sdk

Generic TypeScript SDK for the Kora engine.

This package is intentionally generic:

- it does not know about CMS-specific public content flows
- it does not depend on any UI framework
- it can be used from web apps, React Native, Node services, scripts, and internal tooling

It is useful for:

- custom API clients
- internal backend services
- React or React Native apps
- script-driven integrations
- workflow automation
- extension management

## Architecture and contract migration

The [architecture contract notes](docs/architecture-contracts.md) track the Engine-owned wire boundary. Generated Engine v2 wire types and runtime validators are exported from the SDK root with a development-snapshot base revision and artifact digest. Typed request and workflow methods are available; use `getCapabilities()` to check tenant support because older Engines and tenants without assembled services may not support every endpoint. The Engine remains responsible for authorization and domain eligibility.

## Installation

```bash
npm install @kora/extension-sdk
```

## What It Can Do

The client exposes:

- `callMethod(name, body?)`
- `getSupportingRecord(doctype, name)`
- `listSupportingRecords(doctype, query?)`
- `createSupportingRecord(doctype, doc)`
- `updateSupportingRecord(doctype, name, doc)`
- `deleteSupportingRecord(doctype, name)`
- `bulkCreateSupportingRecords(items)`
- `bulkUpdateSupportingRecords(items)`
- `bulkDeleteSupportingRecords(items)`
- script management
- extension/webhook management
- execution log access

It also exports engine-aligned config types for:

- `DocType`
- `SiteContext`
- `Field`
- `View`
- `ViewComponent`
- `ViewAction`
- `ViewRule`
- `ViewFilter`
- `ViewPublicAccess`
- `PublicAccess`
- `Document`
- `Query`
- `MutationResult`
- `BulkDocItem`
- `BulkDocResult`
- `Workflow`
- `FileRef`

## Configuration

```ts
import { KoraClient } from '@kora/extension-sdk'

const kora = new KoraClient({
  baseUrl: 'https://myapp.kora.dev',
  siteName: 'acme',
  token: 'kxt_your_token',
})
```

Supported auth patterns:

```ts
// Bearer token
new KoraClient({
  baseUrl: 'https://myapp.kora.dev',
  siteName: 'acme',
  token: 'kxt_your_token',
})

// Explicit auth header
new KoraClient({
  baseUrl: 'https://myapp.kora.dev',
  siteName: 'acme',
  authHeader: 'Bearer kxt_your_token',
})

// Dynamic auth provider
new KoraClient({
  baseUrl: 'https://myapp.kora.dev',
  siteName: 'acme',
  authProvider: async () => `Bearer ${await getTokenSomehow()}`,
})
```

You can also inject a custom `fetch` implementation for environments that do not expose a global `fetch`.

All requests are site-scoped under:

```text
/s/:siteName/api/...
```

`callMethod(name, body?)` is the generic server-method bridge. It sends a request to:

```text
POST /s/:siteName/api/method/:name
```

For the method to succeed, the backend must already define an active `api_method` script with the same `method_path` on the same site. The request body is passed through as-is.

### Server-Side Requirements

To make a method callable from the SDK:

- create a script with `script_type: api_method`
- set `method_path` to the public method name
- activate the script
- ensure it is stored for the same site the client is configured with

If any of those are missing, `callMethod()` will fail with a server error or a not-found response.

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

## Extension API Method Calls

`callMethod()` is for site-owned extension APIs that do not replace a protected business operation. Domain changes must use the published operation API above.

```ts
const result = await kora.callMethod('rebuild_extension_search_index', { index: 'help' })
```

`callMethod()` maps to the site API route:

```text
POST /s/:siteName/api/method/:name
```

For the call to succeed, the backend must already define an active `api_method` script with:

- `method_path` set to the method name
- the same `siteName` the client is configured with
- a compiled, active script body

Example:

- `kora.callMethod('rebuild_extension_search_index', { index: 'help' })`
- sends `POST /s/acme/api/method/rebuild_extension_search_index`
- executes the active extension-owned script with that method path
- passes `{ index: 'help' }` as the request body

If the method is missing, inactive, or attached to a different site, the request fails with a not-found or authorization-style server error.

## Script Management

```ts
await kora.createScript({
  name: 'validate_order',
  script_type: 'doc_event',
  doctype: 'Order',
  event: 'before_save',
  script: `
    if (!event.doc.total || event.doc.total <= 0) {
      throw new Error('Total must be greater than zero')
    }
  `,
})
```

## Extension Management

```ts
const extension = await kora.createExtension({
  name: 'warehouse_webhook',
  display_name: 'Warehouse Webhook',
  endpoint_url: 'https://hooks.example.com/kora',
  subscriptions: ['after_insert:Delivery'],
  api_permissions: ['read'],
})
```

## React Native Usage

The SDK is suitable for React Native because it is not tied to browser APIs.

```ts
import { useEffect, useState } from 'react'
import { KoraClient } from '@kora/extension-sdk'

const kora = new KoraClient({
  baseUrl: 'https://myapp.kora.dev',
  siteName: 'acme',
  authProvider: async () => {
    const token = await getStoredToken()
    return `Bearer ${token}`
  },
})

export function OrdersScreen() {
  const [orders, setOrders] = useState<Array<{ name: string; status: string }>>([])

  useEffect(() => {
    let alive = true
    kora.listSupportingRecords('Order', { limit: 20, orderBy: 'modified DESC' }).then((items) => {
      if (alive) setOrders(items)
    })
    return () => {
      alive = false
    }
  }, [])

  return null
}
```

## Backend Service Usage

```ts
import { KoraClient } from '@kora/extension-sdk'

const kora = new KoraClient({
  baseUrl: process.env.KORA_BASE_URL!,
  siteName: process.env.KORA_SITE_NAME!,
  authProvider: () => `Bearer ${process.env.KORA_API_TOKEN!}`,
})

export async function syncInvoice(invoiceId: string) {
  const scoped = kora.withScope({ tenant_id: process.env.KORA_TENANT_ID!, kind: 'tenant' })
  const catalog = await scoped.catalog()
  const query = catalog.published_queries.find(item => item.name === 'invoice_by_id')
  if (!query) throw new Error('Invoice lookup is not published')
  return scoped.queryPublished(catalog, query.owner_module_id, query.name, { input: { invoice_id: invoiceId } })
}
```

## Supported Data Model Types

The SDK exports structural types for the engine config model so app code can stay in sync with Kora:

- `DocType`
- `Field`
- `Constraint`
- `DocConstraint`
- `PublicAccess`
- `PublicFilter`
- `View`
- `ViewComponent`
- `ViewAction`
- `ViewRule`
- `ViewCondition`
- `ViewFilter`
- `ViewPublicAccess`

## Supporting-record Bulk Helpers

Bulk helpers are sequential fan-out over the supporting-record endpoints.
Do not use them to implement a business transaction; publish and execute a domain operation instead.

```ts
const results = await kora.bulkCreateSupportingRecords([
  { doctype: 'Feedback', doc: { title: 'A', rating: 5 } },
  { doctype: 'Feedback', doc: { title: 'B', rating: 4 } },
])

for (const result of results) {
  if (!result.success) {
    console.error(result.index, result.error)
  }
}
```

## Custom UI Model

For a custom Kora UI, these are the core concepts:

- `SiteContext` for the connected site and auth settings
- `DocType` for schema discovery
- `Field` for field rendering and validation
- `View` for layout and route structure
- `Document` for loaded or edited record state
- `Query` for list/search requests
- `Workflow` for allowed state changes and actions
- `FileRef` for uploaded media and attachments

Typical flow:

1. Call `listDoctypes()` or `getDoctype()` to discover schema.
2. Call `listViews()` or `getView()` to find routes and layouts.
3. Call `getSupportingRecord()` / `listSupportingRecords()` to load data.
4. Render fields from the returned schema.
5. Use a published domain operation for owned business changes; use supporting-record methods only where the Engine permits CRUD.
6. Use `uploadFile()` for image and attachment fields.

## File Handling

```ts
const uploaded = await kora.uploadFile(file)
const url = kora.getFileUrl(uploaded.path)
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
