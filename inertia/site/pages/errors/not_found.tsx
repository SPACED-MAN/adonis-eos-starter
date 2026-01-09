import { useState } from 'react'
import { Head } from '@inertiajs/react'

/**
 * Public Site - 404 Not Found / Splash Page
 */
export default function NotFound({
  isDatabaseEmpty,
  hasProtectedAccess,
}: {
  isDatabaseEmpty?: boolean
  hasProtectedAccess?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function getXsrfToken(): string | undefined {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('username', username)
      formData.append('password', password)
      formData.append('strategy', 'replace')
      formData.append('preserveIds', 'true')

      const xsrf = getXsrfToken()
      const res = await fetch('/protected/import', {
        method: 'POST',
        headers: {
          ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
        },
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setStatus({
          type: 'success',
          message: 'Database imported successfully! Redirecting...',
        })
        setTimeout(() => {
          window.location.assign('/')
        }, 2000)
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Import failed',
        })
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'An unexpected error occurred',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Head title={isDatabaseEmpty ? 'Welcome' : 'Page Not Found'} />
      <div className="max-w-md w-full text-center">
        {isDatabaseEmpty ? (
          <div className="mb-8">
            <div className="w-20 h-20 bg-standout-high/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-standout-high"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-standout-high mb-3">Welcome to Adonis EOS</h1>
            <p className="text-neutral-medium mb-8">
              Your installation is complete, but no content has been created yet.
            </p>

            {hasProtectedAccess && (
              <div className="bg-card border border-line-low rounded-xl p-6 text-left shadow-xl">
                <h3 className="text-lg font-semibold text-neutral-high mb-4">Quick Start: Import Data</h3>
                <form onSubmit={handleImport} className="space-y-4">
                  {status && (
                    <div
                      className={`p-3 rounded text-sm ${status.type === 'success'
                          ? 'bg-success/10 text-success border border-success/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}
                    >
                      {status.message}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-neutral-medium mb-1 uppercase tracking-wider">
                      Username
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-line-low rounded bg-backdrop-input text-neutral-high focus:ring-2 focus:ring-standout/20 outline-none"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Admin username"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-medium mb-1 uppercase tracking-wider">
                      Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-line-low rounded bg-backdrop-input text-neutral-high focus:ring-2 focus:ring-standout/20 outline-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Admin password"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-medium mb-1 uppercase tracking-wider">
                      Export File (.json)
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      className="w-full text-sm text-neutral-medium file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-standout-high/10 file:text-standout-high hover:file:bg-standout-high/20"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !file}
                    className="w-full py-2.5 bg-standout-high text-on-high font-semibold rounded hover:bg-standout-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Importing...' : 'Start Import'}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-standout-high mb-2">404</h1>
            <h2 className="text-2xl font-semibold text-neutral-high mb-4">Page Not Found</h2>
            <p className="text-neutral-medium">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
        )}

        {!isDatabaseEmpty && (
          <div className="space-y-3">
            <a
              href="/"
              className="block w-full px-6 py-3 bg-standout-high hover:bg-standout-high/90 text-on-high font-semibold rounded-lg transition-colors"
            >
              Go to Homepage
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
