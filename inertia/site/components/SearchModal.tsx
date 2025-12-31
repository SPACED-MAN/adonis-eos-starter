import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from '~/components/ui/dialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faSpinner, faArrowRight, faBook } from '@fortawesome/free-solid-svg-icons'
import { Link, usePage, router } from '@inertiajs/react'

interface SearchResult {
  id: string
  title: string
  excerpt: string | null
  url: string
}

interface SearchModalProps {
  type?: string
  placeholder?: string
  variant?: 'sidebar' | 'navbar' | 'icon'
}

export function SearchModal({
  type = '',
  placeholder = 'Search...',
  variant = 'sidebar',
}: SearchModalProps) {
  const [open, setOpen] = useState(false)
  const [query, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [mounted, setMounted] = useState(false)
  const { props } = usePage<any>()
  const locale = props.post?.locale || props.locale || 'en'
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === '/') {
        // Only trigger if not already focused on an input
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          !(document.activeElement as HTMLElement)?.isContentEditable
        ) {
          e.preventDefault()
          setOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setQ('')
      setResults([])
      setActiveIndex(-1)
    }
  }, [open])

  // Fetch results
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const url = new URL('/api/search/autocomplete', window.location.origin)
        url.searchParams.set('q', query)
        if (type) url.searchParams.set('type', type)
        if (locale) url.searchParams.set('locale', locale)

        const res = await fetch(url.toString())
        const data = await res.json()
        setResults(data.results || [])
        setActiveIndex(data.results?.length > 0 ? 0 : -1)
      } catch (err) {
        console.error('Search failed', err)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query, locale, type])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const result = results[activeIndex]
      if (result) {
        router.visit(result.url)
        setOpen(false)
      }
    }
  }

  const triggerClasses =
    variant === 'icon'
      ? 'flex h-10 w-10 items-center justify-center text-neutral-high hover:bg-backdrop-medium hover:text-standout-medium transition-all group outline-none'
      : variant === 'navbar'
        ? 'w-64 flex items-center gap-3 px-3 py-2 text-sm text-neutral-high bg-backdrop-low border border-line-medium rounded-md hover:border-standout-medium/50 hover:bg-backdrop-medium transition-all group shadow-sm'
        : 'w-full flex items-center gap-3 px-3 py-2.5 mb-6 text-sm text-neutral-high bg-backdrop-low border border-line-medium rounded-lg hover:border-standout-medium/50 hover:bg-backdrop-medium transition-all group shadow-sm'

  if (!mounted) {
    return (
      <button className={triggerClasses}>
        <FontAwesomeIcon icon={faSearch} size="sm" className="group-hover:text-standout-medium" />
        {variant !== 'icon' && (
          <>
            <span className="flex-1 text-left">{placeholder}</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-line-medium bg-backdrop-medium px-1.5 font-mono text-[10px] font-bold text-neutral-high opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </>
        )}
      </button>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClasses}>
        <FontAwesomeIcon icon={faSearch} size="sm" className="group-hover:text-standout-medium" />
        {variant !== 'icon' && (
          <>
            <span className="flex-1 text-left">{placeholder}</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-line-medium bg-backdrop-medium px-1.5 font-mono text-[10px] font-bold text-neutral-high opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </>
        )}
        {variant === 'icon' && <span className="sr-only">{placeholder}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dark sm:max-w-[600px] p-0 gap-0 overflow-hidden border-line-medium bg-backdrop-low text-neutral-high shadow-2xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search for content across the site.
          </DialogDescription>
          <DialogHeader className="p-4 border-b border-line-low">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faSearch} size="sm" className="text-neutral-low" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent border-none outline-none text-neutral-high placeholder:text-neutral-low/60 text-base"
              />
              {loading && <FontAwesomeIcon icon={faSpinner} spin className="text-standout-medium" />}
            </div>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto p-2">
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map((result, idx) => (
                  <Link
                    key={result.id}
                    href={result.url}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-start gap-4 p-3 rounded-lg transition-colors ${idx === activeIndex
                      ? 'bg-standout-medium/10 border border-standout-medium/20'
                      : 'border border-transparent hover:bg-backdrop-medium'
                      }`}
                  >
                    <div
                      className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${idx === activeIndex
                        ? 'bg-standout-medium text-on-high'
                        : 'bg-backdrop-high text-neutral-medium'
                        }`}
                    >
                      <FontAwesomeIcon icon={faBook} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-medium truncate ${idx === activeIndex ? 'text-standout-medium' : 'text-neutral-high'
                          }`}
                      >
                        {result.title}
                      </div>
                      {result.excerpt && (
                        <p className={`text-xs line-clamp-1 mt-0.5 ${idx === activeIndex ? 'text-neutral-high/70' : 'text-neutral-medium'
                          }`}>
                          {result.excerpt}
                        </p>
                      )}
                    </div>
                    {idx === activeIndex && (
                      <FontAwesomeIcon
                        icon={faArrowRight}
                        size="xs"
                        className="text-standout-medium size-3 mt-2"
                      />
                    )}
                  </Link>
                ))}
              </div>
            ) : query.length >= 2 && !loading ? (
              <div className="py-12 text-center">
                <p className="text-sm text-neutral-medium">No results found for "{query}"</p>
              </div>
            ) : (
              <div className="py-12 text-center text-neutral-low">
                <p className="text-sm">Start typing to search...</p>
                <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-wider font-bold">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-line-medium bg-backdrop-medium">
                      ↑↓
                    </kbd>{' '}
                    to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-line-medium bg-backdrop-medium">
                      ↵
                    </kbd>{' '}
                    to select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-line-medium bg-backdrop-medium">
                      esc
                    </kbd>{' '}
                    to close
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
