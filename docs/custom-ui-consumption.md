# Custom UI Consumption Guide

This SDK is intended to be the shared client for custom UIs, backend services, and automation that need to talk to a Kora site.

## Connection Model

Every client is initialized with:

- `baseUrl`
- `siteName`
- auth configuration

Requests are scoped to:

```text
/s/:siteName/api/...
```

## What To Load First

For a schema-driven UI:

1. Call `getSiteContext()` to inspect the active site.
2. Call `listDoctypes()` or `getDoctype(doctype)` to get structure.
3. Call `listViews()` or `getView(name)` to get layouts and routes.
4. Call `getWorkflow(doctype)` if the UI needs state transitions.
5. Use `getDoc()` and `getList()` to load record data.

## Core Structures

### `DocType`

Use for:

- field discovery
- validation
- titles and sorting
- public access rules
- workflow-aware UI generation

### `Field`

Use for:

- rendering controls
- required/read-only/hidden state
- computed values
- dependency rules
- attachment support

### `View`

Use for:

- page routes
- layouts
- component trees
- field bindings
- actions and rules

### `Document`

Use for:

- editable form state
- normalized record state
- child tables
- attachments

### `Query`

Use for:

- server-side filtering
- search
- paging
- sorting
- field selection

### `Workflow`

Use for:

- state machines
- allowed transitions
- action gating
- approve/reject flows

### `FileRef`

Use for:

- upload results
- image previews
- attachment links

## Suggested UI Flow

1. Discover schema with `getDoctype()` and `getView()`.
2. Map `Field.fieldtype` to UI widgets.
3. Render the form or record detail.
4. Use `uploadFile()` for attachments.
5. Use `createDoc()` or `updateDoc()` to persist changes.
6. Use `submitAction()` for allowed workflow transitions.

## Suggested Backend Flow

1. Load site context.
2. Resolve schema with `getDoctype()` and `getWorkflow()`.
3. Read and validate data.
4. Persist records with `createDoc()` / `updateDoc()`.
5. Trigger actions or integrations as needed.

## File Upload Pattern

```ts
const file = await kora.uploadFile(selectedFile)
const url = kora.getFileUrl(file.path)
```

The SDK does not assume any CMS-specific semantics. It simply gives you the record, view, workflow, and file primitives needed to build your own UI.

## Bulk Operations

Bulk helpers run sequentially over the normal document endpoints and return a per-item status array.

Use them when you want simple batch semantics without depending on a server-side bulk API.

```ts
const created = await kora.bulkCreate([
  { doctype: 'Feedback', doc: { title: 'One' } },
  { doctype: 'Feedback', doc: { title: 'Two' } },
])

const updated = await kora.bulkUpdate([
  { doctype: 'Feedback', name: 'FDB-0001', doc: { rating: 4 } },
])

const deleted = await kora.bulkDelete([
  { doctype: 'Feedback', name: 'FDB-0002' },
])
```
