import { useMemo, useState } from 'react'
import { renderLexicalToHtml } from '../../utils/lexical'
import { usePage } from '@inertiajs/react'

export function AnnouncementBanner() {
  const { props } = usePage<any>()
  const siteSettings = props.siteSettings
  const [isVisible, setIsVisible] = useState(true)

  const announcementHtml = useMemo(() => {
    const customFields = siteSettings?.customFields || {}
    const content = customFields['announcement']

    if (content) {
      let html = ''
      if (typeof content === 'string') {
        const trimmed = content.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            html = renderLexicalToHtml(JSON.parse(trimmed))
          } catch {
            html = content
          }
        } else {
          html = content
        }
      } else {
        html = renderLexicalToHtml(content)
      }

      // Check if it's just an empty paragraph
      if (html && html !== '<p>Empty content</p>' && html !== '<p><br></p>') {
        return html
      }
    }
    return null
  }, [siteSettings])

  if (!announcementHtml || !isVisible) return null

  return (
    <div className="bg-standout-high text-on-high py-2 px-4 relative z-[60]">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div
          className="flex-1 text-sm font-medium text-center prose prose-sm prose-invert max-w-none announcement-content"
          dangerouslySetInnerHTML={{ __html: announcementHtml }}
        />
        <button
          onClick={() => setIsVisible(false)}
          className="text-on-high/80 hover:text-on-high transition-colors p-1"
          aria-label="Close announcement"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <style>{`
        .announcement-content p { margin: 0; }
        .announcement-content a { color: inherit; text-decoration: underline; }
      `}</style>
    </div>
  )
}
