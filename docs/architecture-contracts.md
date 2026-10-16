# SDK contract architecture

Date: 2026-10-16
Status: Engine v2 request/workflow contracts and runtime validators are vendored, root-exported and verified against the clean Engine contract at commit `f939ad94d409d3f74d21a07246485abd2d9027f2` (artifact SHA-256 `1d0fc0cdb31433db902591ccb2c2a1e251da88be898708e40e164dce6670be3f`). Typed request and durable workflow transport methods validate decoded responses. The SDK source remains an unreleased working-tree change; no npm package has been published.

The Engine [target-state specification](../../kora/docs/architecture/target-state-spec.md) owns the wire models and compatibility policy. Hosted source path: [Engine specification](https://github.com/asenawritescode/kora/blob/main/docs/architecture/target-state-spec.md); pin the release commit.

## Boundary

`@kora/extension-sdk` implements transport, cancellation and runtime response validation. It does not decide authorization, approval eligibility, workflow progress or domain invariants. It remains framework-independent.

## G8 source changes

- Completed locally: vendor the Engine-generated v2 DTOs and runtime validators in `src/generated/`; `src/generated/manifest.ts` pins clean Engine commit `f939ad94d409d3f74d21a07246485abd2d9027f2` and the artifact SHA-256. `bun run check:contracts` rejects local artifact drift. The generated contract is merged in Engine; SDK publication is still gated.
- Completed: re-export the generated v2 wire types and validators from the SDK root while retaining existing v1/local abstractions. Tests cover bounded request DTOs, strict workflow step discriminators, finite response-routing keys and the data-minimal workflow event projection.
- Generated decoders now run at request and durable workflow response boundaries. `getCapabilities()` reads Engine navigation, returns an empty list for older servers with no capability projection, and lets consumers check `workflow.orchestration.v2` and `requests.inbox.v2` before exposing those methods.
- Typed request and workflow methods in `src/client.ts` accept optional `AbortSignal`; mutating workflow methods forward stable idempotency keys and preserve the client's timeout.
- Tests cover routes, envelopes, cancellation, stable workflow idempotency headers and malformed contracts. Prior-version Engine compatibility and release checks remain open.
- Correct stale repository metadata in `package.json` when releasing this migration.

Keep generic record operations schema-bound. Fixed approval commands must not become `Record<string, unknown>`. Never add an unrestricted `granted_by` or tenant identity override to a browser command. Information responses use a registered schema/version and bounded JSON payload.

Retain current unversioned and v1 methods through the compatibility window. Wrappers call the same transport/domain boundary; they do not duplicate policy. Do not publish breaking aliases under the existing SDK version.

## Release gates

Pin the Engine contract release, generate reproducibly, compare fixture manifest, run `bun run check:contracts`, `bun run test`, `bun run build`, and `bun run lint`, then test against current and prior compatible Engine versions. Release the SDK before upgrading UI consumers. New clients use capability discovery when connected to older servers. This bundle contains wire contracts only; it does not claim that a server currently supports request/workflow endpoints.

Local release-candidate check on 2026-10-16: `npm run prepublishOnly` passed (build, lint, 29 tests/99 assertions); `npm pack` produced `@kora/extension-sdk@0.1.0` (36.2 kB), and offline installation into `/dev/shm/kora-sdk-consumer` passed. A Node runtime check confirmed the installed package exports the merged Engine source revision and accepts a lowercase 64-character revocation fingerprint while rejecting uppercase input. The public npm registry returns E404 for this package, and `npm whoami` returns ENEEDAUTH. The SDK working tree is also uncommitted. Publish only from an authorized clean SDK release after selecting/reviewing its version and the coordinated consumer order, then retain prior-compatible behavior for the specified window.
