/**
 * Utilities for dealing with JSON/JSONB values that may arrive as strings depending on
 * driver/configuration (e.g. some pg setups return jsonb as a string).
 */

export function coerceJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined) return []
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
      // Handle accidentally-stored "raw builder" objects like:
      // { sql: "?::jsonb", bindings: ["[...json...]"] }
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).bindings)) {
        const b0 = (parsed as any).bindings?.[0]
        if (typeof b0 === 'string') {
          try {
            const inner = JSON.parse(b0)
            return Array.isArray(inner) ? inner : []
          } catch {
            return []
          }
        }
      }
      return []
    } catch {
      return []
    }
  }
  // Some pg setups can return json/jsonb as Buffer/Uint8Array, or as non-plain objects.
  if (typeof value === 'object') {
    // Buffer (node)
    const anyVal: any = value as any
    try {
      // eslint-disable-next-line no-undef
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(anyVal)) {
        const s = anyVal.toString('utf8')
        const parsed = JSON.parse(s)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch {
      // ignore
    }

    // Uint8Array / ArrayBuffer-ish
    try {
      if (anyVal && typeof anyVal.byteLength === 'number' && typeof anyVal.buffer === 'object') {
        const buf = anyVal instanceof Uint8Array ? anyVal : new Uint8Array(anyVal)
        const s = new TextDecoder('utf-8').decode(buf)
        const parsed = JSON.parse(s)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch {
      // ignore
    }

    // Last resort: attempt to deep-clone via JSON stringify (handles some driver wrappers)
    try {
      const cloned = JSON.parse(JSON.stringify(value))
      if (Array.isArray(cloned)) return cloned
      if (cloned && typeof cloned === 'object' && Array.isArray((cloned as any).bindings)) {
        const b0 = (cloned as any).bindings?.[0]
        if (typeof b0 === 'string') {
          try {
            const inner = JSON.parse(b0)
            return Array.isArray(inner) ? inner : []
          } catch {
            return []
          }
        }
      }
      return []
    } catch {
      return []
    }
  }

  return []
}

export function coerceJsonObject(value: unknown): Record<string, any> {
  if (value === null || value === undefined) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      // Handle accidentally-stored "raw builder" objects
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).bindings)) {
        const b0 = (parsed as any).bindings?.[0]
        if (typeof b0 === 'string') {
          try {
            const inner = JSON.parse(b0)
            return inner && typeof inner === 'object' && !Array.isArray(inner) ? inner : {}
          } catch {
            return {}
          }
        }
      }
      return {}
    } catch {
      return {}
    }
  }

  // Buffer (node)
  const anyVal: any = value as any
  try {
    // eslint-disable-next-line no-undef
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(anyVal)) {
      const s = anyVal.toString('utf8')
      const parsed = JSON.parse(s)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    }
  } catch {
    // ignore
  }

  return {}
}
