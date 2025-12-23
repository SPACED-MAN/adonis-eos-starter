import { useEffect, useState } from 'react'
import { renderLexicalToHtml } from '../../modules/prose'

const CONSENT_KEY = 'eos_cookie_consent'

export function CookieConsent() {
  const [enabled, setEnabled] = useState(false)
  const [messageHtml, setMessageHtml] = useState<string | null>(null)
  const [buttonText, setButtonText] = useState('Accept')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if already consented
    const hasConsented = localStorage.getItem(CONSENT_KEY)
    if (hasConsented) return

    ;(async () => {
      try {
        const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const data = j?.data || j
        const customFields = data?.customFields || {}

        const isEnabled = customFields['cookie_consent_enabled'] === true || customFields['cookie_consent_enabled'] === 'true'
        const rawMessage = customFields['cookie_consent_message']
        const rawButtonText = customFields['cookie_consent_button_text']

        if (isEnabled) {
          setEnabled(true)
          setButtonText(rawButtonText || 'Accept')

          if (rawMessage) {
            let html = ''
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
            setMessageHtml(html)
          } else {
            // Default message if none provided
            setMessageHtml('<p>We use cookies to improve your experience on our site.</p>')
          }
          
          setIsVisible(true)
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    setIsVisible(false)
  }

  if (!enabled || !isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-backdrop-low border border-line-medium shadow-2xl rounded-xl p-6 pointer-events-auto flex flex-col md:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex-1">
            <div 
              className="text-sm text-neutral-medium prose prose-sm max-w-none cookie-consent-content"
              dangerouslySetInnerHTML={{ __html: messageHtml || '' }}
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleAccept}
              className="px-6 py-2.5 bg-standout-medium text-on-standout text-sm font-semibold rounded-lg hover:bg-standout-high transition-colors shadow-sm"
            >
              {buttonText}
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

