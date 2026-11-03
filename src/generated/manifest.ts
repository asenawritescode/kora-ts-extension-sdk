// This manifest pins the Engine source revision and bytes used to generate
// engine-v2.ts. Regenerate it only when the Engine contract artifact changes.
export const ENGINE_CONTRACT_MANIFEST = {
  schemaVersion: 2,
  sourceRevision: 'f335c52db317d643ed9d1855096606f01a3714a9',
  sourceTree: 'clean',
  artifact: 'contract/generated/engine-v2.ts',
  artifactSHA256: 'bcad9defd2b53e308d39f8c35751c99969ae8b85af15d09026601ba60c015674',
  schemaSHA256: '75763fe1da273c5e04f0f72cf4d743eb568c9bca5177ae74a868c602710ca693',
} as const
