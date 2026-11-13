// This manifest pins the Engine source revision and bytes used to generate
// engine-v2.ts. Regenerate it only when the Engine contract artifact changes.
export const ENGINE_CONTRACT_MANIFEST = {
  schemaVersion: 2,
  sourceRevision: '25c254758fe6bd41cfee3c09818669d44b34017b',
  sourceTree: 'clean',
  artifact: 'contract/generated/engine-v2.ts',
  artifactSHA256: 'd504bdb6ebff90409bec88588683de502d8dd9b642bbecf889f7e84e1ef95e1e',
  schemaSHA256: '5c8ff139a013ea82eef631b4e5464c9856d1727a00948057b37382d67cbbf932',
} as const
