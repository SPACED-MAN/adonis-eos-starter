/**
 * Token Service - Decoupled utility for template tokens/variables.
 * Denoted by curly braces, e.g. {title}
 */

export interface TokenContext {
  post?: any
  siteSettings?: any
  customFields?: Record<string, any>
  [key: string]: any
}

export class TokenService {
  /**
   * Resolves tokens in a string using the provided context.
   */
  static resolve(text: string | null | undefined, context: TokenContext): string {
    if (!text || typeof text !== 'string') return text || ''

    return text.replace(/\{([^{}]+)\}/g, (match, tokenName) => {
      const value = TokenService.getTokenValue(tokenName, context)
      if (value !== undefined && value !== null) {
        return String(value)
      }
      return match // Keep as is if not found
    })
  }

  /**
   * Resolves tokens recursively in an object or array.
   */
  static resolveRecursive(obj: any, context: TokenContext): any {
    if (!obj) return obj

    if (typeof obj === 'string') {
      return TokenService.resolve(obj, context)
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => TokenService.resolveRecursive(item, context))
    }

    if (typeof obj === 'object') {
      const resolved: Record<string, any> = {}
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = TokenService.resolveRecursive(value, context)
      }
      return resolved
    }

    return obj
  }

  /**
   * Internal helper to extract value for a token name.
   */
  private static getTokenValue(tokenName: string, context: TokenContext): any {
    // Handle post. prefix if present
    const normalizedName = tokenName.startsWith('post.') ? tokenName.replace('post.', '') : tokenName
    const postTokens = [
      'title',
      'slug',
      'excerpt',
      'locale',
      'type',
      'id',
      'metaTitle',
      'metaDescription',
      'canonicalUrl',
    ]

    // 1. Check for post fields directly
    if (context.post) {
      // Handle both plain objects and Lucid models
      const post = context.post
      const postValue = typeof post.toObject === 'function' ? post.toObject()[normalizedName] : post[normalizedName]
      if (postValue !== undefined && postValue !== null) {
        // Prevent self-referencing tokens
        const strVal = String(postValue)
        if (strVal === `{${tokenName}}` || strVal === `{post.${normalizedName}}`) {
          return ''
        }
        return postValue
      } else if (postTokens.includes(normalizedName)) {
        // If it's a known post token but the value is missing, return empty string
        return ''
      }
    }

    // 2. Check for custom fields (e.g. {custom.my_field})
    if (tokenName.startsWith('custom.')) {
      const slug = tokenName.replace('custom.', '')
      if (context.customFields && context.customFields[slug] !== undefined) {
        return context.customFields[slug]
      }
      // Fallback: check post.customFields array if present
      if (context.post?.customFields) {
        const cf = context.post.customFields.find((f: any) => f.slug === slug)
        if (cf) return cf.value
      }
    }

    // 3. System tokens
    if (tokenName === 'now') return new Date().toISOString()
    if (tokenName === 'year') return new Date().getFullYear().toString()

    // 4. Site settings (e.g. {settings.siteName})
    if (tokenName.startsWith('settings.')) {
      const key = tokenName.replace('settings.', '')
      if (context.siteSettings && context.siteSettings[key] !== undefined) {
        return context.siteSettings[key]
      }
    }

    return undefined
  }
}

export default TokenService

