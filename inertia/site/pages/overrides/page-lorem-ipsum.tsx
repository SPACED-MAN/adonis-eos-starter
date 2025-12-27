import { Head } from '@inertiajs/react'
import { SiteHeader } from '../../components/SiteHeader'
import { SiteFooter } from '../../components/SiteFooter'

/**
 * Example static override page for a real CMS post:
 * - post type: page
 * - slug: lorem-ipsum
 *
 * Server-side mapping is in `app/services/site_inertia_overrides_service.ts`.
 */
export default function PageLoremIpsum(props: any) {
  const postTitle = String(props?.post?.metaTitle || props?.post?.title || 'Lorem Ipsum')

  return (
    <>
      <Head title={postTitle} />
      <SiteHeader />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-neutral-high tracking-tight">{postTitle}</h1>
          <p className="mt-4 text-neutral-medium">
            This is a dedicated static Inertia override page. It’s still backed by a normal CMS post
            (so permissions/SEO/modules can still be provided), but the UI here can be fully custom.
          </p>

          <div className="mt-8 rounded-lg border border-line-low bg-backdrop px-5 py-4">
            <div className="text-xs text-neutral-low">Override key</div>
            <div className="mt-1 font-mono text-sm text-neutral-high">
              {props?.inertiaOverride?.key || 'page:lorem-ipsum'}
            </div>
          </div>

          {/* NOTE: Keep this page intentionally simple; teams can extend it as needed. */}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
