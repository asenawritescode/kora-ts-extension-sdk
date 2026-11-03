// This manifest pins the Engine source revision and bytes used to generate
// engine-v2.ts. Regenerate it only when the Engine contract artifact changes.
export const ENGINE_CONTRACT_MANIFEST = {
  schemaVersion: 2,
  sourceRevision: '9e4a1bcc12ac17151a9a7a1b06f1328384b62ac9',
  sourceTree: 'clean',
  artifact: 'contract/generated/engine-v2.ts',
  artifactSHA256: '2984e3b092b7ff71a129fd48809c887f4ff8ac2afa8fb34642b2f2cc2afad872',
  schemaSHA256: '9d4d30ae9f53e3a64cd5c3890f7f3189409c32f5d5d337253533e3816897e98b',
} as const
