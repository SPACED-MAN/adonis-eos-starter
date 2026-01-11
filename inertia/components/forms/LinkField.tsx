import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faSearch, faExternalLinkAlt, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { FormField, FormLabel, FormHelper } from './field'

import { humanizeSlug, slugify, getModuleAnchors } from '~/utils/strings'

export type LinkKind = 'post' | 'url' | 'anchor'

export type LinkFieldValue =
  | {
    kind: 'post'
    postId: string
    postType?: string
    slug?: string
    locale?: string
    url?: string // Resolved URL path (from server)
    target?: '_self' | '_blank'
  }
  | { kind: 'url'; url: string; target?: '_self' | '_blank' }
  | { kind: 'anchor'; anchor: string; moduleId?: string; target?: '_self' | '_blank' }
  | null

type PostOption = {
  id: string
  title: string
  slug: string
  type: string
  locale: string
  status: string
  url?: string // Resolved URL from server
}

function normalizeLinkValue(raw: any): LinkFieldValue {
  if (!raw) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    // Check if it's a stringified JSON object (malformed case)
    if (trimmed.startsWith('{') && trimmed.includes('"kind"')) {
      try {
        const parsed = JSON.parse(trimmed)
        // Recursively normalize the parsed object
        return normalizeLinkValue(parsed)
      } catch {
        // If parsing fails, treat as regular URL string
      }
    }
    // Regular string URL
    const url = trimmed
    return url ? { kind: 'url', url } : null
  }
  if (typeof raw === 'object') {
    const anyVal: any = raw
    if (anyVal.kind === 'post' && anyVal.postId) {
      return {
        kind: 'post',
        postId: String(anyVal.postId),
        postType: anyVal.postType ? String(anyVal.postType) : undefined,
        slug: anyVal.slug ? String(anyVal.slug) : undefined,
        locale: anyVal.locale ? String(anyVal.locale) : undefined,
        url: anyVal.url ? String(anyVal.url) : undefined,
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
    if (anyVal.kind === 'url' && anyVal.url) {
      return {
        kind: 'url',
        url: String(anyVal.url),
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
    if (anyVal.kind === 'anchor' && (anyVal.anchor || anyVal.moduleId)) {
      return {
        kind: 'anchor',
        anchor: String(anyVal.anchor || ''),
        moduleId: anyVal.moduleId ? String(anyVal.moduleId) : undefined,
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
    // Also support shapes like { url } or { postId }
    if (anyVal.url) {
      const url = String(anyVal.url).trim()
      if (!url) return null
      return {
        kind: 'url',
        url,
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
    if (anyVal.postId) {
      return {
        kind: 'post',
        postId: String(anyVal.postId),
        postType: anyVal.postType ? String(anyVal.postType) : undefined,
        slug: anyVal.slug ? String(anyVal.slug) : undefined,
        locale: anyVal.locale ? String(anyVal.locale) : undefined,
        url: anyVal.url ? String(anyVal.url) : undefined,
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
  }
  return null
}

export interface LinkModuleOption {
  id: string
  type: string
  adminLabel?: string | null
}

export interface LinkFieldProps {
  label: string
  value: any
  onChange: (val: LinkFieldValue) => void
  currentLocale?: string
  helperText?: string
  modules?: LinkModuleOption[]
}

export const LinkField: React.FC<LinkFieldProps> = ({
  label,
  value,
  onChange,
  currentLocale,
  helperText,
  modules = [],
}) => {
  const initial = React.useMemo(() => normalizeLinkValue(value), [value])
  // Default mode selection
  const [mode, setMode] = React.useState<LinkKind>(() => {
    if (initial?.kind === 'url') return 'url'
    if (initial?.kind === 'anchor') return 'anchor'
    return 'post'
  })
  const [link, setLink] = React.useState<LinkFieldValue>(initial)
  const [posts, setPosts] = React.useState<PostOption[]>([])
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [urlError, setUrlError] = React.useState<string | null>(null)

  // Track previous normalized value to avoid unnecessary updates
  const prevNormalizedValue = React.useRef<string | null>(null)

  // Update link and mode when value prop changes (only if different)
  React.useEffect(() => {
    const normalized = normalizeLinkValue(value)
    const normalizedStr = JSON.stringify(normalized)

    // Only update if the normalized value is actually different
    if (prevNormalizedValue.current !== normalizedStr) {
      prevNormalizedValue.current = normalizedStr

      if (normalized) {
        setLink(normalized)
        // Update mode based on normalized value
        if (normalized.kind === 'url') {
          setMode('url')
        } else if (normalized.kind === 'anchor') {
          setMode('anchor')
        } else if (normalized.kind === 'post') {
          setMode('post')
        }
      } else {
        setLink(null)
        // If value is cleared, keep the current mode
      }
    }
  }, [value])

  // Only call onChange when link changes from user interaction (not from prop sync)
  // We use a ref to track if this is the initial mount
  const isInitialMount = React.useRef(true)
  React.useEffect(() => {
    // Skip onChange on initial mount (value is already set)
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Compare current link with normalized value to see if this is a user change
    const normalized = normalizeLinkValue(value)
    const linkStr = JSON.stringify(link)
    const normalizedStr = JSON.stringify(normalized)

    // Only call onChange if link differs from the normalized value (user changed it)
    if (linkStr !== normalizedStr) {
      onChange(link)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  React.useEffect(() => {
    if (mode !== 'post') return
    let cancelled = false
    setLoading(true)
    setError(null)
      ; (async () => {
        try {
          // If we have a selected post, fetch it first to ensure it's in the list
          const selectedPostId =
            link && link.kind === 'post' && link.postId ? String(link.postId) : ''

          // Fetch posts list
          const params = new URLSearchParams()
          params.set('status', 'published')
          params.set('hasPermalinks', '1') // Only show linkable posts
          if (currentLocale) params.set('locale', currentLocale)
          params.set('limit', '200')

          // If we have a selected post, also fetch it specifically (in case it's not published)
          const fetchPromises = [
            fetch(`/api/posts?${params.toString()}`, {
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
            }),
          ]

          if (selectedPostId) {
            fetchPromises.push(
              fetch(`/api/posts?ids=${encodeURIComponent(selectedPostId)}`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
              })
            )
          }

          const responses = await Promise.all(fetchPromises)
          const results = await Promise.all(
            responses.map((res) => {
              if (!res.ok) return []
              return res.json().catch(() => ({ data: [] }))
            })
          )

          if (cancelled) return

          // Combine all posts and deduplicate by id
          const allPosts = results.flatMap((j: any) => (Array.isArray(j?.data) ? j.data : []))
          const uniquePosts = new Map<string, any>()
          for (const p of allPosts) {
            uniquePosts.set(String(p.id), p)
          }

          setPosts(
            Array.from(uniquePosts.values()).map((p: any) => ({
              id: String(p.id),
              title: p.title || '(untitled)',
              slug: p.slug,
              type: p.type,
              locale: p.locale,
              status: p.status,
              url: p.url, // Include resolved URL if available
            }))
          )
        } catch (e) {
          if (!cancelled) setError('Failed to load posts')
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [mode, currentLocale, link])

  const selectedPostId: string | '' =
    link && link.kind === 'post' && link.postId ? String(link.postId) : ''

  const anchors = React.useMemo(() => getModuleAnchors(modules), [modules])

  const currentTarget: '_self' | '_blank' =
    link && (link as any).target === '_blank' ? '_blank' : '_self'

  // Validate URL to reject internal relative paths or same-domain URLs
  const validateUrl = (url: string): string | null => {
    const trimmed = url.trim()
    if (!trimmed) return null

    // Reject relative paths
    if (trimmed.startsWith('/')) {
      return 'Internal links should use "Post" instead of relative URLs'
    }

    // Reject same-domain URLs
    try {
      const urlObj = new URL(trimmed)
      const currentDomain = window.location.hostname
      if (urlObj.hostname === currentDomain) {
        return 'Internal links should use "Post" instead of full URLs to this site'
      }
    } catch {
      // Invalid URL format - let the browser's native validation handle it
    }

    return null
  }

  const filteredPosts =
    query.trim().length === 0
      ? posts
      : posts.filter((p) => {
        const needle = query.toLowerCase()
        return (
          (p.title || '').toLowerCase().includes(needle) ||
          (p.slug || '').toLowerCase().includes(needle) ||
          (p.type || '').toLowerCase().includes(needle) ||
          (p.locale || '').toLowerCase().includes(needle)
        )
      })

  return (
    <FormField>
      <FormLabel className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
        {label}
      </FormLabel>
      <div className="bg-backdrop-medium/20 border border-line-medium rounded-2xl p-3 space-y-3 shadow-sm">
        {/* Row 1: Mode Selector & Target Toggle */}
        <div className="flex items-center gap-3">
          <div
            className={`flex-1 flex p-1 bg-backdrop-medium/40 rounded-xl ${modules.length > 0 ? 'max-w-[260px]' : 'max-w-[200px]'
              }`}
          >
            <button
              type="button"
              className={`flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${mode === 'post'
                  ? 'bg-backdrop-low text-neutral-high shadow-sm'
                  : 'text-neutral-low hover:text-neutral-medium'
                }`}
              onClick={() => {
                setMode('post')
                const prevTarget = link && (link as any).target === '_blank' ? '_blank' : '_self'
                if (link && link.kind === 'post') {
                  setLink({ ...link, target: prevTarget })
                } else {
                  setLink(null)
                }
              }}
            >
              Post
            </button>
            <button
              type="button"
              className={`flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${mode === 'url'
                  ? 'bg-backdrop-low text-neutral-high shadow-sm'
                  : 'text-neutral-low hover:text-neutral-medium'
                }`}
              onClick={() => {
                setMode('url')
                const prevTarget = link && (link as any).target === '_blank' ? '_blank' : '_self'
                const currentUrl = link && link.kind === 'url' ? link.url : ''
                setLink(currentUrl ? { kind: 'url', url: currentUrl, target: prevTarget } : null)
              }}
            >
              URL
            </button>
            {modules.length > 0 && (
              <button
                type="button"
                className={`flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${mode === 'anchor'
                    ? 'bg-backdrop-low text-neutral-high shadow-sm'
                    : 'text-neutral-low hover:text-neutral-medium'
                  }`}
                onClick={() => {
                  setMode('anchor')
                  const prevTarget = link && (link as any).target === '_blank' ? '_blank' : '_self'
                  const currentAnchor = link && link.kind === 'anchor' ? link.anchor : ''
                  setLink(
                    currentAnchor
                      ? { kind: 'anchor', anchor: currentAnchor, target: prevTarget }
                      : null
                  )
                }}
              >
                Anchor
              </button>
            )}
          </div>

          {mode !== 'anchor' && (
            <div className="ml-auto">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        const nextTarget = currentTarget === '_blank' ? '_self' : '_blank'
                        setLink((prev) => {
                          if (!prev) return prev
                          return { ...prev, target: nextTarget }
                        })
                      }}
                      className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${currentTarget === '_blank'
                          ? 'bg-standout-high/10 border-standout-high/30 text-standout-high shadow-inner'
                          : 'bg-backdrop-low border-line-medium text-neutral-medium hover:border-neutral-low shadow-sm'
                        }`}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{currentTarget === '_blank' ? 'Opens in New Tab' : 'Opens in Same Tab'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Row 2: Destination Input */}
        <div className="relative">
          {mode === 'url' ? (
            <div className="relative">
              <Input
                type="url"
                placeholder="https://example.com"
                className={`rounded-xl border-line-medium focus:ring-standout-high/20 focus:border-standout-high h-[42px] bg-backdrop-low shadow-inner pl-4 pr-10 transition-all ${urlError ? 'border-danger ring-1 ring-danger/20' : ''
                  }`}
                value={link && link.kind === 'url' ? link.url : ''}
                onChange={(e) => {
                  const val = e.target.value
                  const validationError = validateUrl(val)
                  setUrlError(validationError)

                  setLink((prev) => {
                    const baseTarget = prev && (prev as any).target === '_blank' ? '_blank' : '_self'
                    const trimmed = val.trim()
                    if (validationError) return prev
                    return trimmed ? { kind: 'url', url: trimmed, target: baseTarget } : null
                  })
                }}
              />
              {urlError && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-danger">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <FontAwesomeIcon icon={faCircleExclamation} className="size-4" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-danger text-white border-none">
                        <p>{urlError}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
          ) : mode === 'anchor' ? (
            <Select
              value={link && link.kind === 'anchor' ? link.anchor : ''}
              onValueChange={(val) => {
                const selectedModule = modules.find((m) => {
                  const anchor = anchors.get(m.id)
                  return anchor === val
                })
                setLink((prev) => {
                  const baseTarget = prev && (prev as any).target === '_blank' ? '_blank' : '_self'
                  return val
                    ? {
                      kind: 'anchor',
                      anchor: val,
                      moduleId: selectedModule?.id,
                      target: baseTarget,
                    }
                    : null
                })
              }}
            >
              <SelectTrigger
                aria-label="Select anchor"
                className="w-full h-[42px] rounded-xl border-line-medium bg-backdrop-low shadow-sm focus:ring-standout-high/20 focus:border-standout-high"
              >
                <SelectValue placeholder="Select a module anchor…" />
              </SelectTrigger>
              <SelectContent className="bg-backdrop-low border-line-low rounded-xl shadow-xl z-100">
                {modules.map((m) => {
                  const label = m.adminLabel || humanizeSlug(m.type)
                  const anchor = anchors.get(m.id) || `#${slugify(m.adminLabel || m.type)}`
                  return (
                    <SelectItem
                      key={m.id}
                      value={anchor}
                      className="focus:bg-backdrop-medium rounded-lg"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-[10px] text-neutral-low font-mono">{anchor}</span>
                      </div>
                    </SelectItem>
                  )
                })}
                {modules.length === 0 && (
                  <div className="p-4 text-center text-xs text-neutral-low italic">
                    No modules found on this page
                  </div>
                )}
              </SelectContent>
            </Select>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`w-full text-left px-4 h-[42px] border rounded-xl bg-backdrop-low text-neutral-high hover:bg-backdrop-medium transition-all shadow-sm flex items-center justify-between group overflow-hidden ${selectedPostId ? 'border-standout-high/30' : 'border-line-medium'
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-standout-high/30 border-t-standout-high rounded-full animate-spin shrink-0" />
                    ) : (
                      <FontAwesomeIcon
                        icon={faSearch}
                        className={`size-3.5 shrink-0 transition-colors ${selectedPostId ? 'text-standout-high' : 'text-neutral-low/60 group-hover:text-neutral-medium'
                          }`}
                      />
                    )}
                    <span className="truncate text-sm font-medium">
                      {loading
                        ? 'Syncing posts…'
                        : selectedPostId
                          ? (() => {
                            const p = posts.find((x) => x.id === selectedPostId)
                            return p ? p.title : 'Selected post missing'
                          })()
                          : 'Select destination post…'}
                    </span>
                  </div>
                  <div className="ml-2 flex items-center gap-1.5 shrink-0">
                    {selectedPostId && (() => {
                      const p = posts.find((x) => x.id === selectedPostId)
                      if (!p) return null
                      return (
                        <div className="px-1.5 py-0.5 bg-standout-high/10 rounded text-[9px] font-bold text-standout-high uppercase tracking-tight">
                          {p.type}
                        </div>
                      )
                    })()}
                    <FontAwesomeIcon icon={faChevronDown} size="xs" className="text-neutral-low/40" />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-2 rounded-2xl border-line-low shadow-2xl bg-backdrop-low z-[100]" align="start">
                <div className="space-y-3 p-1">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search title, slug, or post type…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-11 text-sm rounded-xl pl-11 bg-backdrop-medium/30 border-none focus:ring-2 focus:ring-standout-high/20"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-low/60">
                      <FontAwesomeIcon icon={faSearch} size="sm" />
                    </div>
                  </div>
                  <div className="max-h-[350px] overflow-auto space-y-1.5 pr-1 custom-scrollbar">
                    {loading ? (
                      <div className="text-xs text-neutral-low p-12 text-center flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-standout-high/30 border-t-standout-high rounded-full animate-spin" />
                        <span className="font-medium tracking-wide uppercase text-[10px]">Searching…</span>
                      </div>
                    ) : filteredPosts.length === 0 ? (
                      <div className="text-xs text-neutral-low p-12 text-center flex flex-col items-center gap-2">
                        <FontAwesomeIcon icon={faSearch} size="lg" className="opacity-20 mb-2" />
                        <p>No posts found matching &quot;{query}&quot;</p>
                      </div>
                    ) : (
                      filteredPosts.map((p) => {
                        const isSelected = selectedPostId === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${isSelected
                              ? 'border-standout-high bg-standout-high/5 ring-1 ring-standout-high/20'
                              : 'border-transparent hover:bg-backdrop-medium'
                              }`}
                            onClick={() => {
                              setLink({
                                kind: 'post',
                                postId: p.id,
                                postType: p.type,
                                slug: p.slug,
                                locale: p.locale,
                                url: p.url,
                              })
                            }}
                          >
                            <div className="text-sm font-bold text-neutral-high flex items-center justify-between">
                              {p.title}
                              {isSelected && <div className="w-2 h-2 rounded-full bg-standout-high" />}
                            </div>
                            <div className="text-[10px] text-neutral-low font-bold uppercase tracking-wider mt-1.5 flex items-center gap-2 overflow-hidden">
                              <span className="px-2 py-0.5 bg-backdrop-medium rounded text-neutral-medium whitespace-nowrap">{p.type}</span>
                              <span className="opacity-30">/</span>
                              <span className="truncate opacity-70">{p.slug}</span>
                              <span className="ml-auto opacity-50">{p.locale}</span>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Global Helper Text / Current URL Info */}
        {(helperText || (link as any)?.url) && (
          <div className="pt-2 flex flex-col gap-1.5">
            {helperText && (
              <FormHelper className="text-[10px] text-neutral-medium/70 italic leading-snug ml-1">
                {helperText}
              </FormHelper>
            )}
            {link?.kind === 'post' && (link as any).url && (
              <div className="flex items-center gap-1.5 ml-1 overflow-hidden">
                <div className="w-1 h-1 rounded-full bg-standout-high/40" />
                <span className="text-[9px] font-bold text-neutral-low uppercase tracking-wider whitespace-nowrap">Resolves to:</span>
                <span className="text-[9px] font-medium text-neutral-medium truncate">{(link as any).url}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </FormField>
  )
}
