import { usePage } from '@inertiajs/react'
import { MediaRenderer } from '~/components/MediaRenderer'

export function AdminFooter() {
  const page = usePage()
  const { siteSettings } = page.props as any
  const logo = siteSettings?.logoMedia

  return (
    <footer className="border-t border-line-low mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        {logo && (
          <div className="h-6 w-auto opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
            <MediaRenderer
              image={logo}
              alt="Logo"
              className="h-full w-auto object-contain"
            />
          </div>
        )}
      </div>
    </footer>
  )
}
