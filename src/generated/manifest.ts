// This manifest pins the Engine source revision and bytes used to generate
// engine-v2.ts. Regenerate it only when the Engine contract artifact changes.
export const ENGINE_CONTRACT_MANIFEST = {
  schemaVersion: 2,
  sourceRevision: '689e757f3e29321cb85ca55edb9d67d63ddfcb82',
  sourceTree: 'clean',
  artifact: 'contract/generated/engine-v2.ts',
  artifactSHA256: '28087aa21a4f05abc46b3529aa8248741dcdb1c6f745f6c17d0221f03a7ed1dc',
  schemaSHA256: '3a5ebfe44690309b17a0935773def3243dde3f2ae216895d565651dcf45d5249',
} as const
