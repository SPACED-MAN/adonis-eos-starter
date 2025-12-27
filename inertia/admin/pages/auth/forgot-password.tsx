import React from 'react'
import { Head, useForm, usePage, Link } from '@inertiajs/react'
import { useAdminPath } from '~/utils/adminPath'

interface SharedProps {
  csrf: string
  error?: string
  success?: string
  errors?: Record<string, string | string[]>
  [key: string]: any
}

export default function ForgotPassword() {
  const { csrf, error, success, errors } = usePage<SharedProps>().props
  const adminPath = useAdminPath()

  const form = useForm({
    email: '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post(adminPath('forgot-password'))
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-backdrop-medium p-4">
      <Head title="Forgot Password" />
      <form
        onSubmit={submit}
        className="w-full max-w-sm p-6 rounded-xl border border-border bg-backdrop-low shadow-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-neutral-high">Forgot Password</h1>

        <p className="text-sm text-neutral-medium leading-relaxed">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {/* General error message */}
        {error && (
          <div className="p-3 rounded bg-[color:#fef2f2] border border-[color:#fecaca] text-[color:#991b1b] text-sm">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="p-3 rounded bg-green-50 border border-green-200 text-green-800 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-medium">Email</label>
          <input
            type="email"
            className="w-full border border-border rounded px-3 py-2 bg-backdrop-low text-neutral-high placeholder:text-placeholder focus:outline-none focus:ring-1 ring-(--ring) focus:border-transparent"
            value={form.data.email}
            onChange={(e) => form.setData('email', e.target.value)}
            required
            autoFocus
          />
          {errors?.email && (
            <p className="text-sm text-[color:#dc2626]">
              {Array.isArray(errors.email) ? errors.email[0] : errors.email}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-standout-medium text-on-standout rounded px-3 py-2 hover:bg-standout-medium disabled:opacity-50 transition-colors font-semibold"
          disabled={form.processing}
        >
          {form.processing ? 'Sending Link...' : 'Send Reset Link'}
        </button>

        <div className="pt-2 text-center">
          <Link
            href={adminPath('login')}
            className="text-sm text-neutral-medium hover:text-neutral-high underline transition-colors"
          >
            Back to login
          </Link>
        </div>
      </form>
    </div>
  )
}
