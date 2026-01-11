import * as React from 'react'
import { resolveLink } from '../../utils/resolve_link'
import type { LinkValue } from '../../modules/types'
import { useInlineEditor } from '../../components/inline-edit/InlineEditorContext'

interface SiteLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  url?: string | LinkValue | null
  explicitTarget?: '_self' | '_blank'
  children: React.ReactNode
}

/**
 * Common link component for the frontend site.
 * Handles LinkValue resolution, stable anchor lookups (via data-module-id),
 * and target window logic.
 */
export const SiteLink: React.FC<SiteLinkProps> = ({
  url,
  explicitTarget,
  children,
  className,
  ...props
}) => {
  const { modules } = useInlineEditor() || {}
  const resolved = React.useMemo(() => resolveLink(url, explicitTarget, modules), [url, explicitTarget, modules])

  if (!resolved.href) {
    return <span className={className}>{children}</span>
  }

  return (
    <a
      {...props}
      href={resolved.href}
      target={resolved.target}
      rel={resolved.target === '_blank' ? 'noopener noreferrer' : props.rel}
      data-module-id={resolved.moduleId}
      className={className}
    >
      {children}
    </a>
  )
}

