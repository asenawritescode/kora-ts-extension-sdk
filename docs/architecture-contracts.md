# SDK contract architecture

Status: generated contracts and scoped transport are pinned to Engine commit `689e757f3e29321cb85ca55edb9d67d63ddfcb82` (TypeScript SHA-256 `28087aa21a4f05abc46b3529aa8248741dcdb1c6f745f6c17d0221f03a7ed1dc`; schema SHA-256 `3a5ebfe44690309b17a0935773def3243dde3f2ae216895d565651dcf45d5249`). CI compares the SDK bytes with that exact Engine revision.

## Responsibility boundary

The SDK transports the actor's requests and strictly decodes Engine contracts. Engine owns authorization, business scope verification, operation ownership, provider selection, and business invariants. A selected provider or module execution grant never comes from caller input.

## Scoped published client

`KoraClient.withScope(scope)` returns an immutable client carrying one canonical tenant or legal-entity scope. Legal-entity requests include `X-Kora-Legal-Entity-ID`; a request body that specifies a different `business_scope` is rejected before transmission. Auth provider, site routing, cancellation and timeout behavior remain request-local.

Read the actor-filtered application catalog, then use the exact published query or projection route and schema document. Query results retain cursor, snapshot, source revision, time and freshness metadata. A stale or incomplete result remains visibly stale or incomplete.

Submit published operations with a caller-created stable idempotency key and the catalog's exact input schema reference. A timeout remains uncertain; the SDK does not retry automatically or invent a receipt. Use execution lookup by ID or operation/key to recover the server receipt. Completed output is decoded against its published output schema.

Internal and external providers share the same operation and receipt types. The SDK does not expose provider selection as a client option.

## Supporting records

`getSupportingRecord`, `listSupportingRecords`, `createSupportingRecord`, `updateSupportingRecord`, `deleteSupportingRecord`, and the bulk supporting-record helpers are for resources whose Engine policy allows ordinary CRUD. They are not a fallback for module-owned business resources. Bulk helpers fan out sequentially and do not form a business transaction.

`callMethod` remains for active extension-owned APIs outside protected domain operations. Workflow and human-request APIs use generated v2 DTOs, strict response validation, cancellation and stable idempotency keys for writes.

## Validation

Run `bun run check:contracts`, `bun test`, `bun run build`, and `bun run lint`. Contract fixtures are shared with Engine and other first-party consumers. The bundle drift check reads the Engine source checkout pinned in the CI workflow; local agreement between the SDK files and manifest alone is insufficient.
