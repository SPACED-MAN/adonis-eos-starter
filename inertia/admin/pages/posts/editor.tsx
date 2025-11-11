/**
 * Admin Post Editor
 * 
 * Main editing interface for posts with modules, translations, and metadata.
 */

import { useForm } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { FormEvent } from 'react'
import { toast } from 'sonner'

interface EditorProps {
  post: {
    id: string
    type: string
    slug: string
    title: string
    excerpt: string | null
    status: string
    locale: string
    metaTitle: string | null
    metaDescription: string | null
    createdAt: string
    updatedAt: string
  }
}

export default function Editor({ post }: EditorProps) {
  const { data, setData, put, processing, errors } = useForm({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || '',
    status: post.status,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    put(`/api/posts/${post.id}`, {
      onSuccess: () => {
        toast.success('Post updated successfully')
      },
      onError: (errors) => {
        const firstError = Object.values(errors)[0]
        toast.error(firstError || 'Failed to update post')
      },
    })
  }

  return (
    <div className="min-h-screen bg-bg-50">
      <AdminHeader title="Edit Post" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Post Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="bg-bg-100 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                Post Information
              </h2>
              
              <form className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-100 text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter post title"
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.title}</p>
                  )}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={data.slug}
                    onChange={(e) => setData('slug', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-100 text-neutral-900 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="post-slug"
                  />
                  {errors.slug && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.slug}</p>
                  )}
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Excerpt
                  </label>
                  <textarea
                    value={data.excerpt}
                    onChange={(e) => setData('excerpt', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-100 text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Brief description (optional)"
                  />
                  {errors.excerpt && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.excerpt}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Status *
                  </label>
                  <select
                    value={data.status}
                    onChange={(e) => setData('status', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-100 text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                  {errors.status && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.status}</p>
                  )}
                </div>
              </form>
            </div>

            {/* SEO Card */}
            <div className="bg-bg-100 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                SEO Settings
              </h2>
              
              <div className="space-y-4">
                {/* Meta Title */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={data.metaTitle}
                    onChange={(e) => setData('metaTitle', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-100 text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Custom meta title (optional)"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Leave blank to use post title
                  </p>
                </div>

                {/* Meta Description */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Meta Description
                  </label>
                  <textarea
                    value={data.metaDescription}
                    onChange={(e) => setData('metaDescription', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-100 text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Custom meta description (optional)"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Recommended: 150-160 characters
                  </p>
                </div>
              </div>
            </div>

            {/* Modules Section (Placeholder) */}
            <div className="bg-bg-100 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                Modules
              </h2>
              <div className="text-center py-12 text-neutral-500">
                <p>Module editor coming in next increment...</p>
                <p className="text-sm mt-2">ID: {post.id}</p>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Post Details */}
            <div className="bg-bg-100 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">
                Post Details
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-neutral-600">Status</dt>
                  <dd className="font-medium text-neutral-900 capitalize">
                    {data.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-600">Type</dt>
                  <dd className="font-medium text-neutral-900">{post.type}</dd>
                </div>
                <div>
                  <dt className="text-neutral-600">Locale</dt>
                  <dd className="font-medium text-neutral-900">{post.locale}</dd>
                </div>
                <div>
                  <dt className="text-neutral-600">ID</dt>
                  <dd className="font-mono text-xs text-neutral-700 break-all">
                    {post.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-600">Created</dt>
                  <dd className="font-medium text-neutral-900">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-600">Updated</dt>
                  <dd className="font-medium text-neutral-900">
                    {new Date(post.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Quick Actions (Placeholder) */}
            <div className="bg-bg-100 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-bg-100 text-neutral-700">
                  View on Site
                </button>
                <button className="w-full px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-bg-100 text-neutral-700">
                  Manage Translations
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}

