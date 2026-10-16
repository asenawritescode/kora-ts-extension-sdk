import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { ENGINE_CONTRACT_MANIFEST } from '../src/generated/manifest.js'

const artifactPath = fileURLToPath(new URL('../src/generated/engine-v2.ts', import.meta.url))
const bytes = await readFile(artifactPath)
const digest = createHash('sha256').update(bytes).digest('hex')
if (digest !== ENGINE_CONTRACT_MANIFEST.artifactSHA256) {
  throw new Error(`Engine v2 contract drift: got ${digest}, pinned ${ENGINE_CONTRACT_MANIFEST.artifactSHA256}`)
}
if (ENGINE_CONTRACT_MANIFEST.schemaVersion !== 2 ||
    !/^[0-9a-f]{40}$/.test(ENGINE_CONTRACT_MANIFEST.sourceRevision) ||
    !['clean', 'uncommitted'].includes(ENGINE_CONTRACT_MANIFEST.sourceTree)) {
  throw new Error('Engine contract manifest is missing its schema version or pinned source revision')
}
console.log(`Engine v${ENGINE_CONTRACT_MANIFEST.schemaVersion} contract bundle verified (${digest})`)
