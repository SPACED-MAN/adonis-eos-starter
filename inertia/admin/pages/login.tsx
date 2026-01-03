import { Head, useForm, usePage, Link } from '@inertiajs/react'
import { useAdminPath } from '~/utils/adminPath'

interface SharedProps {
  csrf: string
  error?: string
  errors?: Record<string, string | string[]>
  [key: string]: any
}

export default function Login() {
  const { csrf, error, errors } = usePage<SharedProps>().props
  const adminPath = useAdminPath()

  const form = useForm({
    uid: '',
    password: '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post(adminPath('login'))
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-backdrop-medium">
      <Head title="Admin Login" />
      <form
        onSubmit={submit}
        className="w-full max-w-sm p-6 rounded-xl border border-border bg-backdrop-low shadow-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-neutral-high">Admin Login</h1>

        {/* General error message */}
        {error && (
          <div className="p-3 rounded bg-[color:#fef2f2] border border-[color:#fecaca] text-[color:#991b1b] text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-medium">Email or Username</label>
          <input
            type="text"
            className="w-full border border-border rounded px-3 py-2 bg-backdrop-low text-neutral-high placeholder:text-placeholder focus:outline-none focus:ring-1 ring-(--ring) focus:border-transparent"
            value={form.data.uid}
            onChange={(e) => form.setData('uid', e.target.value)}
          />
          {errors?.uid && (
            <p className="text-sm text-[color:#dc2626]">
              {Array.isArray(errors.uid) ? errors.uid[0] : errors.uid}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-medium">Password</label>
          <input
            type="password"
            className="w-full border border-border rounded px-3 py-2 bg-backdrop-low text-neutral-high placeholder:text-placeholder focus:outline-none focus:ring-1 ring-(--ring) focus:border-transparent"
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
          className="w-full bg-standout-high text-on-high rounded px-3 py-2 hover:bg-standout-high disabled:opacity-50 transition-colors"
          disabled={form.processing}
        >
          {form.processing ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="flex items-center justify-between text-sm text-neutral-medium pt-2">
          <a href="/" className="underline hover:no-underline">
            Back to site
          </a>
          <Link href={adminPath('forgot-password')} className="underline hover:no-underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  )
}
