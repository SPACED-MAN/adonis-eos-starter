import { useState } from 'react'
import { Head } from '@inertiajs/react'

export default function ProtectedPage({ redirect }: { redirect?: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const next = redirect || '/'

  // Read CSRF token set by server (Adonis Shield sets XSRF-TOKEN cookie)
  function getXsrfToken(): string | undefined {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const xsrf = getXsrfToken()
    const res = await fetch('/protected/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password, redirect: next }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j?.error || 'Invalid credentials')
      return
    }
    const j = await res.json().catch(() => ({}))
    const to = j?.redirect || next
    window.location.assign(to)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Head title="Protected" />
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-card border border-line-low rounded-lg p-8 shadow-xl"
      >
        <h1 className="text-xl font-bold mb-2 text-neutral-high">Protected Content</h1>
        <p className="text-sm text-neutral-medium mb-6">Enter credentials to view this page.</p>

        {error && (
          <div className="mb-6 p-3 text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-medium mb-1.5">Username</label>
          <input
            className="w-full px-4 py-2.5 border border-line-low rounded bg-backdrop-input text-neutral-high focus:ring-2 focus:ring-standout/20 focus:border-standout outline-none transition-all"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="mb-8">
          <label className="block text-sm font-medium text-neutral-medium mb-1.5">Password</label>
          <input
            type="password"
            className="w-full px-4 py-2.5 border border-line-low rounded bg-backdrop-input text-neutral-high focus:ring-2 focus:ring-standout/20 focus:border-standout outline-none transition-all"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-3 text-sm font-semibold rounded-md bg-standout-high text-on-high hover:bg-standout-medium active:scale-[0.98] transition-all shadow-sm"
        >
          Unlock Content
        </button>
      </form>
    </div>
  )
}
