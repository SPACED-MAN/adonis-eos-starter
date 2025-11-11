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
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-50">
      <Head title="Admin Login" />
      <form onSubmit={submit} className="w-full max-w-sm p-6 rounded-xl border border-neutral-300 bg-bg-100 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold text-neutral-900">Admin Login</h1>

        {/* General error message */}
        {error && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700">Email</label>
          <input
            type="email"
            className="w-full border border-neutral-300 rounded px-3 py-2 bg-bg-100 text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.data.email}
            onChange={(e) => form.setData('email', e.target.value)}
          />
          {errors?.email && (
            <p className="text-sm text-red-600">
              {Array.isArray(errors.email) ? errors.email[0] : errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700">Password</label>
          <input
            type="password"
            className="w-full border border-neutral-300 rounded px-3 py-2 bg-bg-100 text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.data.password}
            onChange={(e) => form.setData('password', e.target.value)}
          />
          {errors?.password && (
            <p className="text-sm text-red-600">
              {Array.isArray(errors.password) ? errors.password[0] : errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-primary-600 text-white rounded px-3 py-2 hover:bg-primary-700 disabled:opacity-50 transition-colors"
          disabled={form.processing}
        >
          {form.processing ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="text-sm text-neutral-700">
          <a href="/" className="underline hover:no-underline">Back to site</a>
        </div>
      </form>
    </div>
  )
}


