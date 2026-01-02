import React from 'react'
import {
  BarChart3,
  Shield,
  Search,
  Image as ImageIcon,
  MessageSquare,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { Link } from '@inertiajs/react'

interface DashboardWidgetProps {
  type: 'seo' | 'analytics' | 'security' | 'media' | 'forms'
  title: string
  data: any
}

export function DashboardWidget({ type, title, data }: DashboardWidgetProps) {
  const getIcon = () => {
    switch (type) {
      case 'seo':
        return <Search className="w-5 h-5 text-indigo-500" />
      case 'analytics':
        return <BarChart3 className="w-5 h-5 text-emerald-500" />
      case 'security':
        return <Shield className="w-5 h-5 text-rose-500" />
      case 'media':
        return <ImageIcon className="w-5 h-5 text-amber-500" />
      case 'forms':
        return <MessageSquare className="w-5 h-5 text-blue-500" />
      default:
        return null
    }
  }

  const renderContent = () => {
    switch (type) {
      case 'seo':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-medium">Sitemap Status:</span>
              <span className="text-neutral-high font-medium">
                {data.lastBuiltAt ? 'Active' : 'Not Generated'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-medium">Last Built:</span>
              <span className="text-neutral-high">
                {data.lastBuiltAt ? new Date(data.lastBuiltAt).toLocaleDateString() : 'Never'}
              </span>
            </div>
            <div className="pt-2">
              <a
                href={data.sitemapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                View Sitemap <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )
      case 'analytics':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-backdrop-medium rounded-lg border border-line-low">
              <div className="text-xs text-neutral-medium mb-1">Total Views</div>
              <div className="text-xl font-bold text-neutral-high">
                {data.totalViews.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-backdrop-medium rounded-lg border border-line-low">
              <div className="text-xs text-neutral-medium mb-1">Total Clicks</div>
              <div className="text-xl font-bold text-neutral-high">
                {data.totalClicks.toLocaleString()}
              </div>
            </div>
          </div>
        )
      case 'security':
        const statusColors = {
          pass: 'text-emerald-500',
          warn: 'text-amber-500',
          fail: 'text-rose-500',
        }
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-medium">Overall Posture:</span>
              <span className={`text-sm font-bold uppercase ${statusColors[data.status as keyof typeof statusColors]}`}>
                {data.status}
              </span>
            </div>
            <div className="w-full bg-backdrop-medium rounded-full h-2 overflow-hidden border border-line-low">
              <div
                className={`h-full ${
                  data.status === 'pass'
                    ? 'bg-emerald-500'
                    : data.status === 'warn'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${(data.passed / data.total) * 100}%` }}
              />
            </div>
            <div className="text-xs text-neutral-medium text-center">
              {data.passed} of {data.total} checks passed
            </div>
          </div>
        )
      case 'media':
        return (
          <div className="flex items-center justify-between p-4 bg-backdrop-medium rounded-lg border border-line-low">
            <div>
              <div className="text-2xl font-bold text-neutral-high">{data.totalFiles}</div>
              <div className="text-xs text-neutral-medium">Files in Library</div>
            </div>
            <Link
              href="/admin/media"
              className="p-2 hover:bg-backdrop-high rounded-full transition-colors"
            >
              <ArrowRight className="w-5 h-5 text-neutral-medium" />
            </Link>
          </div>
        )
      case 'forms':
        return (
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-bold text-neutral-high">{data.totalSubmissions}</span>
              <span className="text-xs text-neutral-medium pb-1">Total Submissions</span>
            </div>
            <div className="space-y-1">
              {data.recent.map((s: any) => (
                <div key={s.id} className="text-xs flex justify-between py-1 border-b border-line-low last:border-0">
                  <span className="text-neutral-high font-medium truncate max-w-[120px]">
                    {s.formSlug}
                  </span>
                  <span className="text-neutral-medium">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const getLink = () => {
    switch (type) {
      case 'seo': return '/admin/settings/seo'
      case 'analytics': return '/admin/security' // Or a dedicated analytics page if it exists
      case 'security': return '/admin/security'
      case 'media': return '/admin/media'
      case 'forms': return '/admin/forms'
      default: return '#'
    }
  }

  return (
    <div className="bg-backdrop-low rounded-xl border border-line-low p-5 flex flex-col h-full hover:border-line-medium transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-backdrop-medium rounded-lg group-hover:bg-backdrop-high transition-colors">
            {getIcon()}
          </div>
          <h3 className="text-sm font-semibold text-neutral-high">{title}</h3>
        </div>
        <Link 
          href={getLink()} 
          className="text-neutral-low hover:text-neutral-medium transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  )
}

