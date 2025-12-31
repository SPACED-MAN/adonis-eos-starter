import React from 'react'
import { Head, useForm, usePage, Link } from '@inertiajs/react'
import { useAdminPath } from '~/utils/adminPath'

interface SharedProps {
  csrf: string
  error?: string
  success?: string
  errors?: Record<string, string | string[]>
  token: string
  [key: string]: any
}

export default function ResetPassword() {
  const { csrf, error, success, errors, token } = usePage<SharedProps>().props
  const adminPath = useAdminPath()

  const form = useForm({
    token: token,
    password: '',
    password_confirmation: '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post(adminPath('reset-password'))
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-backdrop-medium p-4">
      <Head title="Reset Password" />
      <form
        onSubmit={submit}
        className="w-full max-w-sm p-6 rounded-xl border border-border bg-backdrop-low shadow-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-neutral-high">Reset Password</h1>

        <p className="text-sm text-neutral-medium leading-relaxed">
          Please enter your new password below.
        </p>

        {/* General error message */}
        {error && (
          <div className="p-3 rounded bg-[color:#fef2f2] border border-[color:#fecaca] text-[color:#991b1b] text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-medium">New Password</label>
          <input
            type="password"
            className="w-full border border-border rounded px-3 py-2 bg-backdrop-low text-neutral-high placeholder:text-placeholder focus:outline-none focus:ring-1 ring-(--ring) focus:border-transparent"
            value={form.data.password}
            onChange={(e) => form.setData('password', e.target.value)}
            required
            autoFocus
          />
          {errors?.password && (
            <p className="text-sm text-[color:#dc2626]">
              {Array.isArray(errors.password) ? errors.password[0] : errors.password}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-medium">
            Confirm New Password
          </label>
          <input
            type="password"
            className="w-full border border-border rounded px-3 py-2 bg-backdrop-low text-neutral-high placeholder:text-placeholder focus:outline-none focus:ring-1 ring-(--ring) focus:border-transparent"
            value={form.data.password_confirmation}
            onChange={(e) => form.setData('password_confirmation', e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-standout-high text-on-high rounded px-3 py-2 hover:bg-standout-high disabled:opacity-50 transition-colors font-semibold"
          disabled={form.processing}
        >
          {form.processing ? 'Resetting...' : 'Reset Password'}
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
