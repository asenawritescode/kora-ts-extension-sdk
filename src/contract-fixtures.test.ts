import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodeContract } from './generated/engine-v2.js'

const fixtures = JSON.parse(readFileSync(
  fileURLToPath(new URL('../contract-fixtures/client-contracts-v2.json', import.meta.url)),
  'utf8',
)) as {
  valid: Array<{ contract: string; value: unknown }>
  invalid: Array<{ contract: string; value: unknown }>
}

describe('Engine v2 shared contract fixtures', () => {
  it('accepts producer-approved examples', () => {
    for (const example of fixtures.valid) {
      expect(() => decodeContract(example.contract, example.value)).not.toThrow()
    }
  })

  it('rejects malformed scope, references, receipts, queries and workflows', () => {
    for (const example of fixtures.invalid) {
      expect(() => decodeContract(example.contract, example.value)).toThrow()
    }
  })
})
