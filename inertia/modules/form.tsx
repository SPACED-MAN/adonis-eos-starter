import { useEffect, useState, FormEvent } from 'react'

type FormFieldType = 'text' | 'email' | 'textarea' | 'checkbox'

interface FormFieldConfig {
  slug: string
  label: string
  type: FormFieldType
  required?: boolean
}

interface FormDefinition {
  slug: string
  title: string
  description?: string
  fields: FormFieldConfig[]
  successMessage?: string
}

interface FormModuleProps {
  title?: string | null
  subtitle?: string | null
  formSlug: string
}

export default function FormModule({ title, subtitle, formSlug }: FormModuleProps) {
  const [definition, setDefinition] = useState<FormDefinition | null>(null)
  const [values, setValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [successTextOverride, setSuccessTextOverride] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSubmitted(false)
    setErrors({})
    ;(async () => {
      try {
        const res = await fetch(`/api/forms/${encodeURIComponent(formSlug)}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          throw new Error('Failed to load form')
        }
        const j = await res.json().catch(() => null)
        if (!cancelled) {
          const def: FormDefinition | null = j?.data ?? null
          setDefinition(def)
          setValues({})
        }
      } catch {
        if (!cancelled) {
          setDefinition(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [formSlug])

  if (loading) {
    return (
      <section className="bg-backdrop-low py-8 lg:py-16" data-module="form">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-neutral-low">Loading form…</p>
        </div>
      </section>
    )
  }

  if (!definition) {
    return null
  }

  const visibleTitle = title || definition.title

  const handleChange = (field: FormFieldConfig, value: any) => {
    setValues((prev) => ({ ...prev, [field.slug]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})

    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formSlug)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const j = await res.json().catch(() => null)
      if (!res.ok) {
        const errMap: Record<string, string> = (j && j.errors) || {}
        setErrors(errMap)
        setSubmitted(false)
        return
      }

      const data = j?.data || {}
      if (data && typeof data.redirectTo === 'string' && data.redirectTo) {
        window.location.href = data.redirectTo
        return
      }

      if (typeof data.successMessage === 'string' && data.successMessage.trim() !== '') {
        setSuccessTextOverride(data.successMessage)
      } else if (definition?.successMessage && definition.successMessage.trim() !== '') {
        setSuccessTextOverride(definition.successMessage)
      } else {
        setSuccessTextOverride(null)
      }

      setSubmitted(true)
      setValues({})
    } catch {
      // Network or unexpected error – show generic message
      setErrors({ _form: 'Something went wrong. Please try again.' })
      setSubmitted(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bg-backdrop-low py-8 lg:py-16" data-module="form">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-xl">
        {(visibleTitle || subtitle) && (
          <div className="mb-6">
            {visibleTitle && (
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-high mb-2">
                {visibleTitle}
              </h2>
            )}
            {subtitle && <p className="text-sm sm:text-base text-neutral-medium">{subtitle}</p>}
          </div>
        )}

        {submitted && (
          <div className="mb-4 rounded-md bg-success/10 text-success px-4 py-3 text-sm">
            {successTextOverride || 'Thank you! Your submission has been received.'}
          </div>
        )}

        {errors._form && !submitted && (
          <div className="mb-4 rounded-md bg-danger/10 text-danger px-4 py-3 text-sm">
            {errors._form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {definition.fields.map((field) => {
            const fieldError = errors[field.slug]
            const value = values[field.slug] ?? (field.type === 'checkbox' ? false : '')

            const fieldId = `form-field-${field.slug}`
            return (
              <div key={field.slug} className="space-y-1">
                {field.type !== 'checkbox' && (
                  <label htmlFor={fieldId} className="block text-sm font-medium text-neutral-high">
                    {field.label}
                    {field.required && <span className="text-danger ml-0.5">*</span>}
                  </label>
                )}
                {field.type === 'textarea' ? (
                  <textarea
                    id={fieldId}
                    className="block w-full rounded-md border border-line-low bg-backdrop-input px-3 py-2 text-sm text-neutral-high focus:outline-none focus:ring-2 focus:ring-standout-medium/40"
                    rows={4}
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    required={field.required}
                  />
                ) : field.type === 'checkbox' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={fieldId}
                      type="checkbox"
                      className="h-4 w-4 rounded border-line-low bg-backdrop-input text-standout-medium focus:ring-standout-medium/50"
                      checked={Boolean(value)}
                      onChange={(e) => handleChange(field, e.target.checked)}
                    />
                    <label htmlFor={fieldId} className="text-sm text-neutral-medium">
                      {field.label}
                      {field.required && <span className="text-danger ml-0.5">*</span>}
                    </label>
                  </div>
                ) : (
                  <input
                    id={fieldId}
                    type={field.type === 'email' ? 'email' : 'text'}
                    className="block w-full rounded-md border border-line-low bg-backdrop-input px-3 py-2 text-sm text-neutral-high focus:outline-none focus:ring-2 focus:ring-standout-medium/40"
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    required={field.required}
                  />
                )}
                {fieldError && <p className="text-xs text-danger mt-1">{fieldError}</p>}
              </div>
            )
          })}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-5 py-2.5 rounded-md bg-standout-medium text-on-standout text-sm font-medium hover:bg-standout-medium/90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-standout-medium/40"
            >
              {submitting ? 'Sending…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
