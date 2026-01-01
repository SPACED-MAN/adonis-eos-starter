import { useState, useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import { FontAwesomeIcon, getIconProp } from '../site/lib/icons'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface ShareProps {
  title?: string
  alignment?: 'left' | 'center' | 'right'
  theme?: string
  _useReact?: boolean
}

type SocialSharing = {
  network: string
  label: string
  icon: string
  enabled: boolean
}

type SiteSettings = {
  socialSettings?: {
    sharing: SocialSharing[]
  }
}

interface PageProps {
  post: {
    title: string
    publicPath: string
  }
  siteSettings: SiteSettings
  [key: string]: any
}

export default function Share({
  title = 'Share:',
  alignment = 'center',
  theme: initialTheme = 'transparent',
  _useReact = false,
  __moduleId,
}: ShareProps & { __moduleId?: string }) {
  const { props } = usePage<PageProps>()
  const { post, siteSettings } = props
  const sharingNetworks = siteSettings?.socialSettings?.sharing || []
  const enabledNetworks = sharingNetworks.filter((n) => n.enabled)

  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor
  const iconBg = styles.inverted
    ? 'bg-on-high/10 border-on-high/20 text-on-high'
    : 'bg-backdrop-low border-line-low text-neutral-medium'

  if (enabledNetworks.length === 0) return null

  const [currentUrl, setCurrentUrl] = useState('')
  useEffect(() => {
    setCurrentUrl(window.location.href)
  }, [])
  const encodedUrl = encodeURIComponent(currentUrl)
  const encodedTitle = encodeURIComponent(post?.title || '')

  const getShareLink = (network: string) => {
    switch (network) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
      case 'email':
        return `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
      default:
        return null
    }
  }

  const handleShare = (network: string, e: React.MouseEvent) => {
    if (network === 'link') {
      e.preventDefault()
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(currentUrl)
        toast.success('Link copied to clipboard')
      }
      return
    }

    if (network === 'email') return // Let the link handle it

    e.preventDefault()
    const url = getShareLink(network)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer,width=600,height=400')
    }
  }

  const alignmentClass =
    alignment === 'center'
      ? 'justify-center'
      : alignment === 'right'
        ? 'justify-end'
        : 'justify-start'

  const content = (
    <div className={`flex flex-wrap items-center ${alignmentClass} gap-4 relative z-10`}>
      {title && (
        <span className={`text-sm font-bold uppercase tracking-wider ${subtextColor} mr-2`}>
          {title}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {enabledNetworks.map((n, idx) => {
          const item = (
            <a
              key={n.network}
              href={getShareLink(n.network) || '#'}
              onClick={(e) => handleShare(n.network, e)}
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${iconBg} border hover:text-standout-high hover:border-standout-high hover:shadow-sm transition-all duration-200 group`}
              title={`Share on ${n.label}`}
            >
              <FontAwesomeIcon
                icon={getIconProp(n.icon)}
                className="transition-transform group-hover:scale-110"
                size="xs"
              />
            </a>
          )

          if (_useReact) {
            return (
              <motion.div
                key={n.network}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                {item}
              </motion.div>
            )
          }

          return item
        })}
      </div>
    </div>
  )

  return (
    <section
      className={`w-full py-16 lg:py-24 ${styles.containerClasses} relative overflow-hidden`}
      data-module="share"
      data-inline-type="select"
      data-inline-path="theme"
      data-inline-label="Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground component={styles.backgroundComponent} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">{content}</div>
    </section>
  )
}
