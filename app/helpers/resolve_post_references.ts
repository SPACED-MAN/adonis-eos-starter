import urlPatternService from '#services/url_pattern_service'

/**
 * Recursively resolve post references in module props to their canonical URLs
 *
 * Transforms { kind: 'post', postId, ... } to { kind: 'url', url: '/correct/path', ... }
 */
export async function resolvePostReferences(obj: any): Promise<any> {
  if (!obj) return obj

  // Handle stringified JSON objects (common when JSONB was saved as a string)
  if (typeof obj === 'string') {
    const trimmed = obj.trim()
    if (trimmed.startsWith('{') && trimmed.includes('"kind"')) {
      try {
        const parsed = JSON.parse(trimmed)
        return resolvePostReferences(parsed)
      } catch {
        return obj
      }
    }
    return obj
  }

  if (typeof obj !== 'object') return obj

  // Check if this is a post reference
  if (obj.kind === 'post' && obj.postId) {
    try {
      const url = await urlPatternService.buildPostPathForPost(obj.postId)
      return {
        kind: 'url',
        url,
        target: obj.target || '_self',
      }
    } catch (error) {
      // If resolution fails, keep the original object
      console.warn(`Failed to resolve post reference for ${obj.postId}:`, error)
      return obj
    }
  }

  // Recursively process arrays
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => resolvePostReferences(item)))
  }

  // Recursively process object properties
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = await resolvePostReferences(value)
  }

  return result
}
