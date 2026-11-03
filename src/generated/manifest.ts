// This manifest pins the Engine source revision and bytes used to generate
// engine-v2.ts. Regenerate it only when the Engine contract artifact changes.
export const ENGINE_CONTRACT_MANIFEST = {
  schemaVersion: 2,
  sourceRevision: 'b46603edd9b33ab911be695590ab2693797283d9',
  sourceTree: 'clean',
  artifact: 'contract/generated/engine-v2.ts',
  artifactSHA256: '9ccabc4909e9961eabf5caa5d45736fcb6c937c25aaccfe1ab3261be2512f406',
  schemaSHA256: '94ae05b6df8ae32c0ed8d9ab3a72aa1bcc5aac4f389487c42e00cedafa769fb1',
} as const
