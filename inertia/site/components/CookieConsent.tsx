import { useEffect, useMemo, useState } from 'react'
import { renderLexicalToHtml } from '../../utils/lexical'
import { usePage } from '@inertiajs/react'

const CONSENT_KEY = 'eos_cookie_consent'

export function CookieConsent() {
  const { props } = usePage<any>()
  const siteSettings = props.siteSettings
  const [isConsented, setIsConsented] = useState(true) // Default to true until we check localStorage

  useEffect(() => {
    const hasConsented = localStorage.getItem(CONSENT_KEY)
    if (!hasConsented) {
      setIsConsented(false)
    }
  }, [])

  const config = useMemo(() => {
    const customFields = siteSettings?.customFields || {}
    const isEnabled =
      customFields['cookie_consent_enabled'] === true ||
      customFields['cookie_consent_enabled'] === 'true'
    const rawMessage = customFields['cookie_consent_message']
    const rawButtonText = customFields['cookie_consent_button_text']

    if (!isEnabled) return null

    let html = ''
    if (rawMessage) {
      if (typeof rawMessage === 'string') {
        const trimmed = rawMessage.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            html = renderLexicalToHtml(JSON.parse(trimmed))
          } catch {
            html = rawMessage
          }
        } else {
          html = rawMessage
        }
      } else {
        html = renderLexicalToHtml(rawMessage)
      }
    } else {
      html = '<p>We use cookies to improve your experience on our site.</p>'
    }

    return {
      messageHtml: html,
      buttonText: rawButtonText || 'Accept',
    }
  }, [siteSettings])

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    setIsConsented(true)
  }

  if (!config || isConsented) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-backdrop-low border border-line-medium shadow-2xl rounded-xl p-6 pointer-events-auto flex flex-col md:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex-1">
            <div
              className="text-sm text-neutral-medium prose prose-sm max-w-none cookie-consent-content"
              dangerouslySetInnerHTML={{ __html: config.messageHtml }}
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleAccept}
              className="px-6 py-2.5 bg-standout-medium text-on-standout text-sm font-semibold rounded-lg hover:bg-standout-high transition-colors shadow-sm"
            >
              {config.buttonText}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .cookie-consent-content p { margin: 0; }
        .cookie-consent-content a { color: inherit; text-decoration: underline; }
      `}</style>
    </div>
  )
}
