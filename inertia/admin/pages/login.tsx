import { Head, useForm, usePage } from '@inertiajs/react'

interface SharedProps {
  csrf: string
  error?: string
  errors?: Record<string, string | string[]>
  [key: string]: any
}

export default function Login() {
  const { csrf, error, errors } = usePage<SharedProps>().props

  const form = useForm({
    email: '',
    password: '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post('/admin/login')
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-backdrop-low">
      <Head title="Admin Login" />
      <form onSubmit={submit} className="w-full max-w-sm p-6 rounded-xl border border-border bg-backdrop-low shadow-sm space-y-4">
        <h1 className="text-xl font-semibold text-neutral-high">Admin Login</h1>

        {/* General error message */}
        {error && (
          <div className="p-3 rounded bg-[color:#fef2f2] border border-[color:#fecaca] text-[color:#991b1b] text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-medium">Email</label>
          <input
            type="email"
            className="w-full border border-border rounded px-3 py-2 bg-backdrop-low text-neutral-high placeholder:text-placeholder focus:outline-none focus:ring-2 ring-standout"
            value={form.data.email}
            onChange={(e) => form.setData('email', e.target.value)}
          />
          {errors?.email && (
            <p className="text-sm text-[color:#dc2626]">
              {Array.isArray(errors.email) ? errors.email[0] : errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-medium">Password</label>
          <input
            type="password"
            className="w-full border border-border rounded px-3 py-2 bg-backdrop-low text-neutral-high placeholder:text-placeholder focus:outline-none focus:ring-2 ring-standout"
            value={form.data.password}
            onChange={(e) => form.setData('password', e.target.value)}
          />
          {errors?.password && (
            <p className="text-sm text-[color:#dc2626]">
              {Array.isArray(errors.password) ? errors.password[0] : errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-standout text-on-standout rounded px-3 py-2 hover:bg-standout disabled:opacity-50 transition-colors"
          disabled={form.processing}
        >
          {form.processing ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="text-sm text-neutral-medium">
          <a href="/" className="underline hover:no-underline">Back to site</a>
        </div>
      </form>
    </div>
  )
}


