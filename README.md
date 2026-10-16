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

The [architecture contract notes](docs/architecture-contracts.md) track the Engine-owned wire boundary. Generated Engine v2 wire types and runtime validators are exported from the SDK root with a development-snapshot base revision and artifact digest. Request/workflow transport methods are not exposed until the Engine endpoints and capability gates are implemented.

## Installation

```bash
npm install @kora/extension-sdk
```

## What It Can Do

The client exposes:

- `callMethod(name, body?)`
- `getDoc(doctype, name)`
- `getList(doctype, query?)`
- `createDoc(doctype, doc)`
- `updateDoc(doctype, name, doc)`
- `deleteDoc(doctype, name)`
- `bulkCreate(items)`
- `bulkUpdate(items)`
- `bulkDelete(items)`
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

## Document CRUD

```ts
const customer = await kora.getDoc<{ name: string; email: string }>('Customer', 'CUST-0001')

const customers = await kora.getList<{ name: string; full_name: string }>('Customer', {
  limit: 20,
  offset: 0,
  filters: [['status', '=', 'Active']],
  orderBy: 'modified DESC',
})

await kora.createDoc('Feedback', {
  title: 'Great product',
  rating: 5,
})

await kora.updateDoc('Feedback', 'FDB-0001', {
  rating: 4,
})

await kora.deleteDoc('Feedback', 'FDB-0001')

const bulkCreated = await kora.bulkCreate([
  { doctype: 'Feedback', doc: { title: 'Great product', rating: 5 } },
  { doctype: 'Feedback', doc: { title: 'Needs work', rating: 2 } },
])

const bulkUpdated = await kora.bulkUpdate([
  { doctype: 'Feedback', name: 'FDB-0001', doc: { rating: 4 } },
])

const bulkDeleted = await kora.bulkDelete([
  { doctype: 'Feedback', name: 'FDB-0002' },
])
```

## Generic API Method Calls

```ts
const result = await kora.callMethod('send_invoice', { orderId: 'ORD-0001' })
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

- `kora.callMethod('sync_invoice_to_erp', { invoiceId })`
- sends `POST /s/acme/api/method/sync_invoice_to_erp`
- executes the active script whose `script_type` is `api_method` and `method_path` is `sync_invoice_to_erp`
- passes `{ invoiceId }` as the request body

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
    kora.getList('Order', { limit: 20, orderBy: 'modified DESC' }).then((items) => {
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
  const invoice = await kora.getDoc('Invoice', invoiceId)
  if (!invoice) {
    throw new Error('Invoice not found')
  }

  await kora.callMethod('sync_invoice_to_erp', { invoiceId })
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

## Bulk Operations

Bulk helpers are sequential fan-out over the standard document endpoints.
They are designed for predictable behavior across UI and backend clients.

```ts
const results = await kora.bulkCreate([
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
3. Call `getDoc()` / `getList()` to load data.
4. Render fields from the returned schema.
5. Submit with `createDoc()` / `updateDoc()` / `submitAction()`.
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
  await kora.getDoc('Order', 'ORD-0001')
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

## Versioning

This package follows semantic versioning.

## License

MIT
