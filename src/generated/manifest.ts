// This manifest pins the Engine source revision and bytes used to generate
// engine-v2.ts. Regenerate it only when the Engine contract artifact changes.
export const ENGINE_CONTRACT_MANIFEST = {
  schemaVersion: 2,
  sourceRevision: '63c01b9a2ad7e33b8836a784c44670f2f9a53b2e',
  sourceTree: 'clean',
  artifact: 'contract/generated/engine-v2.ts',
  artifactSHA256: '500567e5e8fff2df79bc9eb8540960d7d92c3ebcc93d66939b20bf5f42d346c5',
  schemaSHA256: '5a81ada8ca91c87ddee76797e3e0322d1ed17a384eb1d18a6f96d7f31767d366',
} as const
