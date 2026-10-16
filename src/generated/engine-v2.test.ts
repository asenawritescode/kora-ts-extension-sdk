import { describe, expect, it } from 'bun:test'
import { decodeContract, isContract, type ApplyPackage, type MarketplacePackageManifest, type PackFile, type RequestHistoryEntry, type StepDefinition, type SubmitRequest, type WorkflowEventData } from '../index.js'

describe('generated Engine v2 contracts', () => {
  it('validates and decodes request DTOs from the root SDK export', () => {
    const submit = {
      meta: { idempotency_key: 'request-submit-0001' },
      kind: 'approval',
      title: 'Approve invoice',
      message: 'Review the invoice total.',
      subject: { kind: 'Invoice', id: 'INV-1', revision: '3' },
    }
    expect(isContract<SubmitRequest>('SubmitRequest', submit)).toBe(true)
    expect(decodeContract<SubmitRequest>('SubmitRequest', submit)).toEqual(submit)
  })

  it('preserves the previous and replacement users in reassignment history', () => {
    const entry: RequestHistoryEntry = {
      sequence: '4', kind: 'reassigned', actor: 'manager-1', assignment_id: '01K7ASSIGNMENT000000000000000',
      previous_assignee: { kind: 'user', id: 'old-user' }, new_assignee: { kind: 'user', id: 'new-user' },
      comment: 'Delegated after a membership change', at: '2026-10-14T10:00:00Z',
    }
    expect(decodeContract<RequestHistoryEntry>('RequestHistoryEntry', entry)).toEqual(entry)
  })

  it('rejects unknown fields, invalid enum values, oversized pages and non-JSON data', () => {
    expect(isContract('SubmitRequest', {
      meta: { idempotency_key: 'request-submit-0001' }, kind: 'purchase', title: 'x', message: 'y',
    })).toBe(false)
    expect(isContract('SubmitRequest', {
      meta: { idempotency_key: 'request-submit-0001' }, kind: 'approval', title: 'x', message: 'y', forged_actor: 'admin',
    })).toBe(false)
    expect(isContract('PageRequest', { limit: 101 })).toBe(false)
    expect(isContract('InformationResponse', { schema_id: 'answer', schema_version: 1, values: { bad: () => undefined } })).toBe(false)
  })

  it('enforces generated string, UTF-8 byte, item and JSON payload bounds', () => {
    const base = { meta: { idempotency_key: 'request-submit-0001' }, kind: 'approval', message: 'ok' }
    expect(isContract('SubmitRequest', { ...base, title: '' })).toBe(false)
    expect(isContract('SubmitRequest', { ...base, title: 'x'.repeat(161) })).toBe(false)
    expect(isContract('SubmitRequest', { ...base, title: 'x', message: 'é'.repeat(4097) })).toBe(false)

    const assignees = Array.from({ length: 51 }, (_, index) => ({ kind: 'user', id: String(index) }))
    expect(isContract('AssignmentSpec', { mode: 'any', assignees })).toBe(false)
    expect(isContract('InformationResponse', {
      schema_id: 'answer', schema_version: 1, values: { answer: 'x'.repeat(65536) },
    })).toBe(false)
  })

  it('uses strict workflow discriminators and finite response routing keys', () => {
    const action: StepDefinition = { id: 'approve', kind: 'action', action: {
      name: 'invoice.approve', version: 1, input_schema: 'invoice-approval', input: {}, next: 'done',
    } }
    expect(decodeContract<StepDefinition>('StepDefinition', action)).toEqual(action)
    expect(isContract('StepDefinition', { ...action, kind: 'end' })).toBe(false)
    expect(isContract('StepDefinition', { ...action, extra: true })).toBe(false)

    const human = {
      request: { kind: 'approval', subject: 'instance_subject', title: 'Approve', message: 'Review this.', policy_id: 'invoice-policy', due_after_seconds: 3600 },
      outcomes: { approve: 'done', reject: 'done', return_for_changes: 'done' },
      on_expired: 'done', on_cancelled: 'done', on_stale: 'done',
    }
    expect(isContract('HumanSpec', human)).toBe(true)
    expect(isContract('HumanSpec', { ...human, outcomes: { ...human.outcomes, forged: 'done' } })).toBe(false)
  })

  it('validates the workflow event projection without exposing subject data', () => {
    const event: WorkflowEventData = { instance_id: '01K7INSTANCE00000000000000000', revision: '1', change_kind: 'started' }
    expect(decodeContract<WorkflowEventData>('WorkflowEventData', event)).toEqual(event)
    expect(isContract('WorkflowEventData', { ...event, subject: { id: 'secret' } })).toBe(false)
  })

  it('validates management DTO bounds, digest references, and versioned projections', () => {
    const apply: ApplyPackage = {
      meta: { idempotency_key: 'apply-package-0001' }, tenant_id: 'tenant-1',
      artifact_ref: 'object:release-42', digest: 'a'.repeat(64), expected_config_revision: '7',
    }
    expect(decodeContract<ApplyPackage>('ApplyPackage', apply)).toEqual(apply)
    expect(isContract('ApplyPackage', { ...apply, digest: 'A'.repeat(64) })).toBe(false)
    expect(isContract('ApplyPackage', { ...apply, artifact_ref: 'https://example.test/artifact' })).toBe(false)
    expect(isContract('ProvisionTenant', {
      meta: { idempotency_key: 'provision-tenant-0001' }, tenant_id: 'tenant-1',
      bootstrap_admin_email: 'admin@example.test', primary_alias: 'tenant.example.test', aliases: [], deployment_id: 'deploy-1', database_allocation_ref: 'mysql:allocation-1',
    })).toBe(true)
    expect(isContract('ProvisionTenant', {
      meta: { idempotency_key: 'provision-tenant-0001' }, tenant_id: 'tenant-1',
      bootstrap_admin_email: 'admin@example.test', primary_alias: 'tenant.example.test', aliases: ['Tenant.example.test'], deployment_id: 'deploy-1', database_allocation_ref: 'mysql://user:pass@host/db',
    })).toBe(false)
    expect(isContract('TenantDescriptorV2', {
      version: 1, site_id: 'tenant-1', aliases: [], status: 'active',
      config_revision: '1', directory_revision: '1',
    })).toBe(false)
  })

  it('validates shared marketplace package artifact DTOs and per-file byte limits', () => {
    const manifest: MarketplacePackageManifest = {
      schema_version: 1, package_id: 'retail', release_id: 'retail-1', version: '1.0.0', kind: 'module',
      public: { slug: 'retail', name: 'Retail', summary: 'Retail package' },
      engine: { min_version: '1.0.0' },
    }
    const file: PackFile = { path: 'doctypes/stock.yaml', content_type: 'doctype', content: 'name: Stock\n' }
    expect(decodeContract<MarketplacePackageManifest>('MarketplacePackageManifest', manifest)).toEqual(manifest)
    expect(decodeContract<PackFile>('PackFile', file)).toEqual(file)
    expect(isContract('PackFile', { ...file, content: 'x'.repeat(262145) })).toBe(false)
    expect(isContract('MarketplacePackageManifest', { ...manifest, unsigned_field: true })).toBe(false)
  })

  it('validates tenant invitation mailbox bounds from the shared schema', () => {
    const valid = { meta: { idempotency_key: 'invitation-key-0001' }, email: 'owner@example.test' }
    expect(isContract('RequestTenantInvitation', valid)).toBe(true)
    expect(isContract('RequestTenantInvitation', { ...valid, email: 'x' })).toBe(false)
    expect(isContract('RequestTenantInvitation', { ...valid, email: `a${'x'.repeat(250)}@example.test` })).toBe(false)
  })

  it('validates the managed credential fingerprint before revocation', () => {
    const valid = { credential_fingerprint: 'a'.repeat(64) }
    expect(isContract('RevokeManagedChannelClientV2', valid)).toBe(true)
    expect(isContract('RevokeManagedChannelClientV2', { ...valid, credential_fingerprint: 'A'.repeat(64) })).toBe(false)
    expect(isContract('RevokeManagedChannelClientV2', { ...valid, credential_fingerprint: 'a'.repeat(63) })).toBe(false)
    expect(isContract('RevokeManagedChannelClientResultV2', { revoked: true })).toBe(true)
  })
})
