// This manifest pins the Engine source revision and bytes used to generate
// engine-v2.ts. Regenerate it only when the Engine contract artifact changes.
export const ENGINE_CONTRACT_MANIFEST = {
  schemaVersion: 2,
  sourceRevision: 'e711d5d93b2f4b45053681f2b5da40a0699ed2a7',
  sourceTree: 'clean',
  artifact: 'contract/generated/engine-v2.ts',
  artifactSHA256: '5a59ff0b3577b18b92c474a62fdbc254cfb3bd192afdf82b4f66530e94edb13c',
  schemaSHA256: '42e7f0c264aeaec1a75a8c7dad9fc87f37ef0a4853dfb6dbfa3811550a4ac757',
} as const
