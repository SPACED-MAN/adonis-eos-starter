import { useEffect, useState, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

type FormFieldType =
  | 'text'
  | 'email'
  | 'textarea'
  | 'checkbox'
  | 'boolean'
  | 'number'
  | 'date'
  | 'url'
  | 'select'
  | 'multiselect'

interface FormFieldConfig {
  slug: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: Array<{ label: string; value: any }>
  placeholder?: string
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
  __postId?: string
  backgroundColor?: string
  _useReact?: boolean
}

export default function FormModule({
  title,
  subtitle,
  formSlug,
  __postId,
  backgroundColor = 'bg-backdrop-low',
  _useReact,
  __moduleId,
}: FormModuleProps & { __moduleId?: string }) {
  const [definition, setDefinition] = useState<FormDefinition | null>(null)
  const [values, setValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [successTextOverride, setSuccessTextOverride] = useState<string | null>(null)

  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor
  const isDarkBg = bg === 'bg-neutral-high'
  const textColor = isDarkBg ? 'text-backdrop-low' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-backdrop-low/80' : 'text-neutral-medium'
  const inputBg = isDarkBg
    ? 'bg-backdrop-low/10 text-backdrop-low border-backdrop-low/20 placeholder:text-backdrop-low/40'
    : 'bg-backdrop-input text-neutral-high border-line-low'
  const labelColor = isDarkBg ? 'text-backdrop-low' : 'text-neutral-high'

  const visibleTitle = title || definition?.title || ''

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  if (loading) {
    return (
      <section className={`${bg} py-8 lg:py-16`} data-module="form">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className={`text-sm ${subtextColor}`}>Loading form...</p>
        </div>
      </section>
    )
  }

  if (!definition) {
    return null
  }

  const handleChange = (slug: string, value: any) => {
    setValues((prev) => ({ ...prev, [slug]: value }))
  }

  const handleMultiselectChange = (slug: string, value: string, checked: boolean) => {
    setValues((prev) => {
      const current = Array.isArray(prev[slug]) ? prev[slug] : []
      if (checked) {
        return { ...prev, [slug]: [...current, value] }
      } else {
        return { ...prev, [slug]: current.filter((v: string) => v !== value) }
      }
    })
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
        body: JSON.stringify({
          ...values,
          __origin_post_id: __postId,
        }),
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

  const formFields = definition.fields.map((field) => {
    const fieldError = errors[field.slug]
    const rawValue = values[field.slug]
    const fieldId = `form-field-${field.slug}`
    const isCheckbox = field.type === 'checkbox' || field.type === 'boolean'

    const fieldContent = (
      <div className="space-y-1">
        {!isCheckbox && (
          <label htmlFor={fieldId} className={`block text-sm font-medium ${labelColor}`}>
            {field.label}
            {field.required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}

        {(() => {
          switch (field.type) {
            case 'textarea':
              return (
                <textarea
                  id={fieldId}
                  className={`block w-full rounded-md border ${inputBg} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-standout-medium/40 transition-all`}
                  rows={4}
                  placeholder={field.placeholder}
                  value={rawValue ?? ''}
                  onChange={(e) => handleChange(field.slug, e.target.value)}
                  required={field.required}
                />
              )

            case 'checkbox':
            case 'boolean':
              return (
                <div className="flex items-center gap-2">
                  <input
                    id={fieldId}
                    type="checkbox"
                    className={`h-4 w-4 rounded border-line-low ${isDarkBg ? 'bg-backdrop-low/10 text-backdrop-low' : 'bg-backdrop-input text-standout-medium'} focus:ring-standout-medium/50`}
                    checked={Boolean(rawValue)}
                    onChange={(e) => handleChange(field.slug, e.target.checked)}
                  />
                  <label htmlFor={fieldId} className={`text-sm ${subtextColor}`}>
                    {field.label}
                    {field.required && <span className="text-danger ml-0.5">*</span>}
                  </label>
                </div>
              )

            case 'select':
              return (
                <select
                  id={fieldId}
                  className={`block w-full rounded-md border ${inputBg} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-standout-medium/40 transition-all`}
                  value={rawValue ?? ''}
                  onChange={(e) => handleChange(field.slug, e.target.value)}
                  required={field.required}
                >
                  <option value="">{field.placeholder || 'Select an option'}</option>
                  {(field.options || []).map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )

            case 'multiselect':
              return (
                <div
                  className={`space-y-2 p-3 border ${isDarkBg ? 'border-backdrop-low/20 bg-backdrop-low/5' : 'border-line-low bg-backdrop-input/50'} rounded-md`}
                >
                  {(field.options || []).map((opt) => {
                    const optId = `${fieldId}-${opt.value}`
                    const isChecked =
                      Array.isArray(rawValue) && rawValue.includes(String(opt.value))
                    return (
                      <div key={String(opt.value)} className="flex items-center gap-2">
                        <input
                          id={optId}
                          type="checkbox"
                          className={`h-4 w-4 rounded border-line-low ${isDarkBg ? 'bg-backdrop-low/10 text-backdrop-low' : 'bg-backdrop-input text-standout-medium'} focus:ring-standout-medium/50`}
                          checked={isChecked}
                          onChange={(e) =>
                            handleMultiselectChange(field.slug, String(opt.value), e.target.checked)
                          }
                        />
                        <label htmlFor={optId} className={`text-sm ${subtextColor} cursor-pointer`}>
                          {opt.label}
                        </label>
                      </div>
                    )
                  })}
                </div>
              )

            case 'number':
            case 'date':
            case 'url':
            case 'email':
            case 'text':
            default:
              return (
                <input
                  id={fieldId}
                  type={
                    field.type === 'boolean'
                      ? 'checkbox'
                      : field.type === 'multiselect'
                        ? 'text'
                        : field.type
                  }
                  className={`block w-full rounded-md border ${inputBg} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-standout-medium/40 transition-all`}
                  placeholder={field.placeholder}
                  value={rawValue ?? ''}
                  onChange={(e) => handleChange(field.slug, e.target.value)}
                  required={field.required}
                />
              )
          }
        })()}

        {fieldError && <p className="text-xs text-danger mt-1">{fieldError}</p>}
      </div>
    )

    return _useReact ? (
      <motion.div key={field.slug} variants={itemVariants}>
        {fieldContent}
      </motion.div>
    ) : (
      <div key={field.slug}>{fieldContent}</div>
    )
  })

  const formBody = (
    <>
      {_useReact ? (
        <motion.div variants={itemVariants}>
          {(visibleTitle || subtitle) && (
            <div className="mb-6">
              {visibleTitle && (
                <h2
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${textColor} mb-2`}
                >
                  {visibleTitle}
                </h2>
              )}
              {subtitle && <p className={`text-sm sm:text-base ${subtextColor}`}>{subtitle}</p>}
            </div>
          )}
        </motion.div>
      ) : (
        <>
          {(visibleTitle || subtitle) && (
            <div className="mb-6">
              {visibleTitle && (
                <h2
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${textColor} mb-2`}
                >
                  {visibleTitle}
                </h2>
              )}
              {subtitle && <p className={`text-sm sm:text-base ${subtextColor}`}>{subtitle}</p>}
            </div>
          )}
        </>
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

      {_useReact ? (
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {formFields}
          <motion.div variants={itemVariants}>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center px-5 py-2.5 rounded-md ${isDarkBg ? 'bg-backdrop-low text-neutral-high' : 'bg-standout-medium text-on-standout'} text-sm font-medium hover:bg-standout-medium/90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-standout-medium/40 transition-all active:scale-95`}
            >
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </motion.div>
        </motion.form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields}
          <div>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center px-5 py-2.5 rounded-md ${isDarkBg ? 'bg-backdrop-low text-neutral-high' : 'bg-standout-medium text-on-standout'} text-sm font-medium hover:bg-standout-medium/90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-standout-medium/40 transition-all active:scale-95`}
            >
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </>
  )

  return (
    <section
      className={`${bg} py-8 lg:py-16`}
      data-module="form"
      data-inline-type="select"
      data-inline-path="backgroundColor"
      data-inline-options={JSON.stringify([
        { label: 'Transparent', value: 'bg-transparent' },
        { label: 'Low', value: 'bg-backdrop-low' },
        { label: 'Medium', value: 'bg-backdrop-medium' },
        { label: 'High', value: 'bg-backdrop-high' },
        { label: 'Dark', value: 'bg-neutral-high' },
      ])}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-xl">{formBody}</div>
    </section>
  )
}
