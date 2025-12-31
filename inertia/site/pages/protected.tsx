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
    <div className="min-h-screen flex items-center justify-center bg-backdrop-low">
      <Head title="Protected" />
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border border-line-low rounded p-6 shadow"
      >
        <h1 className="text-lg font-semibold mb-4">Protected Content</h1>
        <p className="text-sm text-neutral-medium mb-4">Enter credentials to view this page.</p>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <div className="mb-3">
          <label className="block text-sm text-neutral-medium mb-1">Username</label>
          <input
            className="w-full px-3 py-2 border border-line-low rounded bg-backdrop-low"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm text-neutral-medium mb-1">Password</label>
          <input
            type="password"
            className="w-full px-3 py-2 border border-line-low rounded bg-backdrop-low"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full px-3 py-2 text-sm border border-line-low rounded bg-standout-high text-on-high"
        >
          Unlock
        </button>
      </form>
    </div>
  )
}
