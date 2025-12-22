/**
 * Utility to resolve LinkValue objects to actual URLs.
 *
 * Important: for post references we must use server-resolved URLs (urlPatternService),
 * not hardcoded client patterns, otherwise URL patterns like "/module-catalog" break.
 */

import type { LinkValue } from '../modules/types'

export interface ResolvedLink {
  href?: string
  target: '_self' | '_blank'
}

export function resolveLink(
  url: string | LinkValue | null | undefined,
  explicitTarget?: '_self' | '_blank'
): ResolvedLink {
  let href: string | undefined
  let target: '_self' | '_blank' = '_self'

  if (!url) return { href: undefined, target }

  // Handle string URLs (and stringified JSON objects)
  if (typeof url === 'string') {
    const trimmed = url.trim()
    if (trimmed.startsWith('{') && trimmed.includes('"kind"')) {
      try {
        const parsed = JSON.parse(trimmed)
        return resolveLink(parsed, explicitTarget)
      } catch {
        return { href: undefined, target: explicitTarget || '_self' }
      }
    }
    return { href: trimmed || undefined, target: explicitTarget || '_self' }
  }

  // Handle LinkValue objects
  if (url.kind === 'url') {
    href = url.url
    target = url.target === '_blank' ? '_blank' : '_self'
  } else if (url.kind === 'post') {
    // Only trust server-resolved URL patterns (url field). If missing, caller may fetch/resolve.
    href = url.url || undefined
    target = url.target === '_blank' ? '_blank' : '_self'
  }

  if (explicitTarget) target = explicitTarget
  return { href, target }
}

/**
 * Resolve a post reference by fetching from the posts API.
 *
 * Note: this only returns a URL if the API includes `url` (server-resolved permalink).
 * We intentionally do NOT build URLs from slug/type here because it breaks URL patterns.
 */
export async function resolvePostLink(
  postId: string,
  target?: '_self' | '_blank'
): Promise<ResolvedLink> {
  try {
    const res = await fetch(`/api/public/posts?ids=${encodeURIComponent(postId)}&limit=1`, {
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) return { href: undefined, target: target || '_self' }

    const data = await res.json().catch(() => null)
    const posts = data?.data || []
    const post = Array.isArray(posts) && posts.length > 0 ? posts[0] : null

    if (!post || !post.url) return { href: undefined, target: target || '_self' }

    return { href: post.url, target: target || '_self' }
  } catch {
    return { href: undefined, target: target || '_self' }
  }
}


