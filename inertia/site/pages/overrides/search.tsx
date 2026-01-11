import { Head } from '@inertiajs/react'
import { SiteHeader } from '../../components/SiteHeader'
import { SiteFooter } from '../../components/SiteFooter'

type SearchResult = {
  id: string
  type: string
  title: string
  excerpt: string | null
  slug: string
  locale: string
  url: string
  updatedAt: string
}

export default function SearchPage(props: {
  q: string
  type: string
  locale: string
  postTypes: string[]
  results: SearchResult[]
  limit: number
}) {
  const q = String(props.q || '')
  const type = String(props.type || '')

  return (
    <>
      <Head title={q ? `Search: ${q}` : 'Search'} />
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold text-neutral-high tracking-tight">Search</h1>
          <p className="mt-2 text-sm text-neutral-medium">
            Search published content{props.locale ? ` (${props.locale})` : ''}.
          </p>

          <form
            method="get"
            action="/search"
            className="mt-6 grid grid-cols-1 sm:grid-cols-5 gap-3"
          >
            <input type="hidden" name="locale" value={props.locale} />
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-neutral-medium mb-1">Query</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search…"
                className="w-full rounded-md border border-line-medium bg-backdrop px-3 py-2 text-sm text-neutral-high placeholder:text-neutral-low outline-none focus:ring-2 focus:ring-standout-high/30 focus:border-standout-high/40"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-medium mb-1">
                Post type
              </label>
              <select
                name="type"
                defaultValue={type}
                className="w-full rounded-md border border-line-medium bg-backdrop px-3 py-2 text-sm text-neutral-high outline-none focus:ring-2 focus:ring-standout-high/30 focus:border-standout-high/40"
              >
                <option value="">All types</option>
                {props.postTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-5 flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-standout-high text-on-high text-sm px-4 py-2"
              >
                Search
              </button>
              {q && (
                <a
                  href={`/search?locale=${encodeURIComponent(props.locale)}`}
                  className="text-sm text-neutral-medium hover:text-neutral-high"
                >
                  Clear
                </a>
              )}
            </div>
          </form>

          {q.length === 0 ? (
            <div className="mt-8 rounded-lg border border-line-low bg-backdrop px-4 py-4 text-sm text-neutral-medium">
              Enter a query to see results.
            </div>
          ) : (
            <div className="mt-10">
              <div className="text-xs text-neutral-low mb-3">
                Showing {props.results.length} result{props.results.length === 1 ? '' : 's'}
                {props.results.length >= props.limit ? ` (limited to ${props.limit})` : ''}.
              </div>
              {props.results.length === 0 ? (
                <div className="rounded-lg border border-line-low bg-backdrop px-4 py-4 text-sm text-neutral-medium">
                  No results found.
                </div>
              ) : (
                <ul className="space-y-3">
                  {props.results.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-line-low bg-backdrop px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <a
                            href={r.url}
                            className="text-base font-medium text-neutral-high hover:underline"
                          >
                            {r.title}
                          </a>
                          <div className="mt-1 text-xs text-neutral-low">
                            <span className="font-mono">{r.type}</span>
                            <span className="mx-2 text-neutral-low/40">·</span>
                            <span className="font-mono">{r.slug}</span>
                          </div>
                          {r.excerpt && (
                            <p className="mt-2 text-sm text-neutral-medium line-clamp-3">
                              {r.excerpt}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-[11px] text-neutral-low whitespace-nowrap" suppressHydrationWarning>
                          Updated {new Date(r.updatedAt).toLocaleDateString('en-US')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
