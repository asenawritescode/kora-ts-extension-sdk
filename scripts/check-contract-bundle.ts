import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { ENGINE_CONTRACT_MANIFEST } from '../src/generated/manifest.js'

const artifactPath = fileURLToPath(new URL('../src/generated/engine-v2.ts', import.meta.url))
const bytes = await readFile(artifactPath)
const digest = createHash('sha256').update(bytes).digest('hex')
if (digest !== ENGINE_CONTRACT_MANIFEST.artifactSHA256) {
  throw new Error(`Engine v2 contract drift: got ${digest}, pinned ${ENGINE_CONTRACT_MANIFEST.artifactSHA256}`)
}
const engineRoot = process.env.KORA_ENGINE_ROOT
if (!engineRoot) throw new Error('KORA_ENGINE_ROOT must point to the authoritative Engine checkout')
const engineRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: engineRoot, encoding: 'utf8' }).trim()
if (engineRevision !== ENGINE_CONTRACT_MANIFEST.sourceRevision) {
  throw new Error(`Engine source revision drift: got ${engineRevision}, pinned ${ENGINE_CONTRACT_MANIFEST.sourceRevision}`)
}
const engineArtifact = await readFile(resolve(engineRoot, 'contract/generated/engine-v2.ts'))
const engineDigest = createHash('sha256').update(engineArtifact).digest('hex')
if (engineDigest !== digest) throw new Error(`SDK bundle differs from Engine source: ${digest} vs ${engineDigest}`)
if (ENGINE_CONTRACT_MANIFEST.schemaVersion !== 2 ||
    !/^[0-9a-f]{40}$/.test(ENGINE_CONTRACT_MANIFEST.sourceRevision) ||
    !['clean', 'uncommitted'].includes(ENGINE_CONTRACT_MANIFEST.sourceTree)) {
  throw new Error('Engine contract manifest is missing its schema version or pinned source revision')
}
console.log(`Engine v${ENGINE_CONTRACT_MANIFEST.schemaVersion} contract bundle verified (${digest})`)
