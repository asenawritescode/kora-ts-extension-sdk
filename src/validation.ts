import { ScriptType, EventType } from './types.js'

/** Validates a script name. Returns error message or null if valid. */
export function validateScriptName (name: string): string | null {
  if (!name || name.length === 0) return 'Name is required'
  if (name.length > 140) return 'Name must be 140 characters or less'
  if (!/^[a-z][a-z0-9_]*$/.test(name)) return 'Name must start with a letter and contain only lowercase letters, numbers, and underscores'
  return null
}

/** Validates a script type. Returns error message or null if valid. */
export function validateScriptType (type: string): string | null {
  const validTypes = Object.values(ScriptType)
  if (!validTypes.includes(type as ScriptType)) {
    return `Invalid script type. Must be one of: ${validTypes.join(', ')}`
  }
  return null
}

/** Gets the valid events for a given script type. */
export function validEventsForType (type: string): string[] {
  switch (type) {
    case 'doc_event':
      return Object.values(EventType)
    case 'api_method':
      return []
    case 'workflow_action':
      return []
    case 'scheduled':
      return []
    default:
      return []
  }
}
