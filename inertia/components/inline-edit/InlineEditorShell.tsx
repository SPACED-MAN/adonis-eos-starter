import { InlineOverlay } from './InlineOverlay'
import { InlineEditorProvider } from './InlineEditorProvider'
import { StaticInlineEditorProvider } from './InlineEditorContext'
import React, { Component, type ReactNode } from 'react'
import { TooltipProvider } from '~/components/ui/tooltip'
import { ConfirmDialogProvider } from '~/components/ConfirmDialogProvider'
import '~/site/lib/admin-icons'

class InlineErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('InlineEditorShell Crash:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

interface InlineEditorShellProps {
  children: React.ReactNode
  postId: string
  post?: any
  translations?: any[]
  modules: any[]
  availableModes?: { hasSource: boolean; hasReview: boolean; hasAiReview: boolean }
  abVariations?: Array<{ id: string; variation: string; status: string }>
}

export default function InlineEditorShell({
  children,
  postId,
  post,
  translations,
  modules,
  availableModes,
  abVariations,
}: InlineEditorShellProps) {
  const fallback = (
    <StaticInlineEditorProvider
      postId={postId}
      post={post}
      translations={translations}
      modules={modules}
      availableModes={availableModes}
      abVariations={abVariations}
    >
      {children}
    </StaticInlineEditorProvider>
  )

  return (
    <InlineErrorBoundary fallback={fallback}>
      <TooltipProvider>
        <ConfirmDialogProvider>
          <InlineEditorProvider
            postId={postId}
            post={post}
            translations={translations}
            modules={modules}
            availableModes={availableModes}
            abVariations={abVariations}
          >
            {children}
            <InlineOverlay />
          </InlineEditorProvider>
        </ConfirmDialogProvider>
      </TooltipProvider>
    </InlineErrorBoundary>
  )
}
