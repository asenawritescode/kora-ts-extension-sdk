/** Validate JSON values against an owner-published schema document. */
export function assertPublishedSchema (schema: unknown, value: unknown): void {
  const failure = validate(schema, value, schema, 0)
  if (failure) throw new TypeError(`Published schema validation failed: ${failure}`)
}

function validate (schemaValue: unknown, value: unknown, root: unknown, depth: number): string | undefined {
  if (depth > 64 || !isObject(schemaValue)) return 'invalid schema or nesting depth'
  const schema = schemaValue
  if (typeof schema.$ref === 'string') {
    const target = resolveRef(root, schema.$ref)
    if (target === undefined) return `unresolved schema reference ${schema.$ref}`
    const failure = validate(target, value, root, depth + 1)
    if (failure) return failure
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((part: unknown) => validate(part, value, root, depth + 1) === undefined).length
    if (matches !== 1) return 'oneOf constraint failed'
  }
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some((part: unknown) => validate(part, value, root, depth + 1) === undefined)) return 'anyOf constraint failed'
  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf) { const failure = validate(part, value, root, depth + 1); if (failure) return failure }
  }
  if (schema.not !== undefined && validate(schema.not, value, root, depth + 1) === undefined) return 'not constraint failed'
  if (schema.const !== undefined && !equalJSON(value, schema.const)) return 'const constraint failed'
  if (Array.isArray(schema.enum) && !schema.enum.some((item: unknown) => equalJSON(value, item))) return 'enum constraint failed'
  if (typeof schema.type === 'string' && !hasType(schema.type, value)) return `expected ${schema.type}`
  if (typeof value === 'string') {
    const length = Array.from(value).length
    if (typeof schema.minLength === 'number' && length < schema.minLength) return 'string is too short'
    if (typeof schema.maxLength === 'number' && length > schema.maxLength) return 'string is too long'
    if (typeof schema['x-max-utf8-bytes'] === 'number' && new TextEncoder().encode(value).length > schema['x-max-utf8-bytes']) return 'string exceeds UTF-8 byte limit'
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) return 'string pattern mismatch'
    if (schema.format === 'date-time' && (!Number.isFinite(Date.parse(value)) || !value.includes('T'))) return 'invalid date-time'
    if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'invalid email'
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) return 'number below minimum'
    if (typeof schema.maximum === 'number' && value > schema.maximum) return 'number above maximum'
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) return 'array too short'
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) return 'array too long'
    if (schema.items !== undefined) for (const item of value) { const failure = validate(schema.items, item, root, depth + 1); if (failure) return failure }
  }
  if (isObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const key of required) if (typeof key !== 'string' || !(key in value)) return `missing required property ${String(key)}`
    const properties = isObject(schema.properties) ? schema.properties : {}
    for (const [key, item] of Object.entries(value)) {
      const propertySchema = properties[key]
      if (propertySchema === undefined) {
        if (schema.additionalProperties === false) return `unknown property ${key}`
        if (isObject(schema.additionalProperties)) { const failure = validate(schema.additionalProperties, item, root, depth + 1); if (failure) return failure }
      } else {
        const failure = validate(propertySchema, item, root, depth + 1)
        if (failure) return `${key}: ${failure}`
      }
    }
  }
  const byteLimit = schema['x-max-json-bytes']
  if (typeof byteLimit === 'number' && new TextEncoder().encode(JSON.stringify(value)).length > byteLimit) return 'JSON value exceeds byte limit'
  return undefined
}

function isObject (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasType (type: string, value: unknown): boolean {
  switch (type) {
    case 'object': return isObject(value)
    case 'array': return Array.isArray(value)
    case 'string': return typeof value === 'string'
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'boolean': return typeof value === 'boolean'
    case 'null': return value === null
    default: return false
  }
}

function resolveRef (root: unknown, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined
  let value = root
  for (const rawPart of ref.slice(2).split('/')) {
    const part = rawPart.replaceAll('~1', '/').replaceAll('~0', '~')
    if (!isObject(value) || !(part in value)) return undefined
    value = value[part]
  }
  return value
}

function equalJSON (left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
