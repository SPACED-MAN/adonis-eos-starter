/**
 * Reusable Agent Modal Component
 *
 * Provides a consistent agent interaction interface with:
 * - Chat history display
 * - Request/response handling
 * - Loading states
 * - Auto-scroll to bottom
 */

import { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Textarea } from '~/components/ui/textarea'
import { Spinner } from '~/components/ui/spinner'

export interface Agent {
  id: string
  name: string
  description?: string
  openEndedContext?: {
    enabled: boolean
    label?: string
    placeholder?: string
    maxChars?: number
  }
}

export interface ExecutionMeta {
  model: string
  provider: string
  totalTurns: number
  durationMs: number
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AgentHistoryItem {
  id: string
  request: string | null
  response: {
    rawResponse?: string
    summary?: string
    applied?: string[]
    executionMeta?: ExecutionMeta
    [key: string]: any
  } | null
  createdAt: string
  user: { id: number; email: string; fullName: string | null } | null
}

export interface AgentResponse {
  rawResponse?: string
  summary?: string | null
  applied?: string[]
  message?: string
  generatedMediaId?: string // Media ID if an image was generated
  suggestions?: any
  executionMeta?: ExecutionMeta
}

type AgentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: Agent | null
  contextId?: string // Post ID, field key, etc. - for history and execution
  context?: {
    locale?: string
    viewMode?: string
    [key: string]: any
  }
  onSuccess?: (response: AgentResponse) => void
  scope?: 'dropdown' | 'global' | 'field'
  fieldKey?: string
  fieldType?: string
  viewMode?: 'source' | 'review' | 'ai-review'
}

export function AgentModal({
  open,
  onOpenChange,
  agent,
  contextId,
  context = {},
  onSuccess,
  scope = 'dropdown',
  fieldKey,
  fieldType,
  viewMode,
}: AgentModalProps) {
  const [runningAgent, setRunningAgent] = useState(false)
  const [agentOpenEndedContext, setAgentOpenEndedContext] = useState('')
  const [agentResponse, setAgentResponse] = useState<AgentResponse | null>(null)
  const [agentHistory, setAgentHistory] = useState<AgentHistoryItem[]>([])
  const [loadingAgentHistory, setLoadingAgentHistory] = useState(false)
  const agentModalContentRef = useRef<HTMLDivElement | null>(null)

  // Load agent history when dialog opens and agent is selected
  // Works for all scopes: post-based (with contextId) and global (without contextId)
  useEffect(() => {
    if (!open || !agent) {
      setAgentHistory([])
      return
    }
    let alive = true
    async function loadHistory() {
      try {
        setLoadingAgentHistory(true)
        // For global scope, use the global history endpoint
        // For other scopes, use the post-based history endpoint
        const agentId = agent?.id
        if (!agentId) {
          if (alive) setLoadingAgentHistory(false)
          return
        }
        const url =
          scope === 'global' && !contextId
            ? `/api/agents/${agentId}/history?scope=global`
            : contextId
              ? `/api/posts/${contextId}/agents/${agentId}/history`
              : null

        if (!url) {
          if (alive) setLoadingAgentHistory(false)
          return
        }

        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        })
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (!json?.data) return
        if (alive) setAgentHistory(Array.isArray(json.data) ? json.data : [])
      } catch {
        // Ignore errors
      } finally {
        if (alive) setLoadingAgentHistory(false)
      }
    }
    loadHistory()
    return () => {
      alive = false
    }
  }, [open, agent?.id, contextId, scope])

  // Scroll modal to bottom when it opens or history loads
  useEffect(() => {
    if (open && agentModalContentRef.current) {
      setTimeout(() => {
        if (agentModalContentRef.current) {
          agentModalContentRef.current.scrollTop = agentModalContentRef.current.scrollHeight
        }
      }, 150)
    }
  }, [open, loadingAgentHistory, agentHistory])

  const handleRunAgent = async () => {
    if (!agent) return
    // For global scope, contextId is optional
    if (scope !== 'global' && !contextId) return

    // CRITICAL: Set running state BEFORE any async operations
    // This prevents the dialog from closing via onOpenChange
    setRunningAgent(true)
    setAgentResponse(null)
    // Force dialog to stay open
    if (!open) {
      onOpenChange(true)
    }
    try {
      const csrf = (() => {
        if (typeof document === 'undefined') return undefined
        const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      })()

      const openEnded = agentOpenEndedContext.trim()
      // For global scope, we might not have a contextId
      const url = contextId
        ? `/api/posts/${contextId}/agents/${encodeURIComponent(agent.id)}/run`
        : `/api/agents/${encodeURIComponent(agent.id)}/run`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          context: {
            ...context,
            scope,
            fieldKey,
            fieldType,
            viewMode: viewMode || undefined,
          },
          openEndedContext: openEnded || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        const response: AgentResponse = {
          rawResponse: j.rawResponse,
          summary: j.summary || null,
          applied: j.applied || [],
          message: j.message,
          generatedMediaId: j.generatedMediaId,
          suggestions: j.suggestions,
          executionMeta: j.executionMeta,
        }
        setAgentResponse(response)
        toast.success('Agent completed successfully')

        // Perform a background reload to update the UI while the modal is still open
        if (contextId && scope !== 'global') {
          router.reload({
            only: ['post', 'modules', 'aiReviewDraft', 'reviewDraft'],
          })
        }

        // Refresh agent history (works for both post-based and global)
        try {
          const historyUrl =
            scope === 'global' && !contextId
              ? `/api/agents/${encodeURIComponent(agent.id)}/history?scope=global`
              : contextId
                ? `/api/posts/${contextId}/agents/${encodeURIComponent(agent.id)}/history`
                : null

          if (historyUrl) {
            const historyRes = await fetch(historyUrl, {
              headers: { Accept: 'application/json' },
              credentials: 'same-origin',
            })
            if (historyRes.ok) {
              const historyJson = await historyRes.json().catch(() => null)
              if (historyJson?.data) {
                setAgentHistory(Array.isArray(historyJson.data) ? historyJson.data : [])
              }
            }
          }
        } catch {
          // Ignore history refresh errors
        }

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(response)
        }
      } else {
        toast.error(j?.error || 'Agent run failed')
        setAgentResponse({
          message: `Error: ${j?.error || 'Agent run failed'}`,
        })
      }
    } catch (error: any) {
      console.error('Agent execution error:', error)
      toast.error('Agent run failed')
      setAgentResponse({
        message: `Error: ${error?.message || 'Agent run failed'}`,
      })
    } finally {
      setRunningAgent(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    // Always allow opening (even if running - shouldn't happen but be safe)
    if (newOpen && !open) {
      onOpenChange(true)
      return
    }
    // Don't allow closing if agent is running or has a response
    if ((runningAgent || agentResponse) && !newOpen) {
      // Force dialog to stay open - prevent closing
      return
    }
    // Only allow closing when not running and no response
    if (!runningAgent && !agentResponse) {
      onOpenChange(newOpen)
      if (!newOpen) {
        // Reset response when closing
        setAgentResponse(null)
        setAgentOpenEndedContext('')
      }
    }
  }

  if (!agent) return null

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        ref={agentModalContentRef}
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
      >
        {agentResponse ? (
          <AlertDialogHeader>
            <AlertDialogTitle>Agent Response</AlertDialogTitle>
            <AlertDialogDescription>
              Review the AI response and changes that were applied:
            </AlertDialogDescription>
          </AlertDialogHeader>
        ) : (
          <AlertDialogHeader className="sr-only">
            <AlertDialogTitle>{agent?.name || 'AI Assistant'}</AlertDialogTitle>
            <AlertDialogDescription>
              {agent?.description || 'Provide instructions for the AI agent to execute.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
        )}

        {runningAgent ? (
          <div className="mt-3 space-y-4">
            <div className="flex items-center gap-3">
              <Spinner className="size-5 text-primary" />
              <div className="text-sm font-medium">Running agent...</div>
            </div>
            <div className="text-xs text-neutral-medium">
              Please wait while the agent processes your request.
            </div>
          </div>
        ) : !agentResponse ? (
          <div className="mt-3 space-y-4">
            {/* Agent History */}
            {loadingAgentHistory ? (
              <div className="flex items-center gap-2 text-xs text-neutral-medium">
                <Spinner className="size-4" />
                <span>Loading history...</span>
              </div>
            ) : agentHistory.length > 0 ? (
              <div className="space-y-3">
                {[...agentHistory].reverse().map((item) => (
                  <div key={item.id} className="space-y-2">
                    {/* User Request */}
                    {item.request && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] space-y-1">
                          {item.user && (
                            <div className="text-xs text-neutral-medium text-right mb-1">
                              {item.user.fullName || item.user.email}
                            </div>
                          )}
                          <div className="bg-primary text-on-primary p-3 rounded-lg rounded-tr-sm text-sm">
                            {item.request}
                          </div>
                          <div className="text-xs text-neutral-low text-right">
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* AI Response */}
                    {item.response && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] space-y-1">
                          <div className="bg-backdrop-medium p-3 rounded-lg rounded-tl-sm border border-line-medium text-sm">
                            {item.response.summary ||
                              (item.response.rawResponse
                                ? (() => {
                                  try {
                                    const jsonMatch = item.response.rawResponse?.match(
                                      /```(?:json)?\s*(\{[\s\S]*\})\s*```/
                                    )
                                    const jsonStr = jsonMatch
                                      ? jsonMatch[1]
                                      : item.response.rawResponse
                                    const parsed = JSON.parse(jsonStr)
                                    return parsed.summary || 'Changes applied.'
                                  } catch {
                                    return item.response.rawResponse || 'Changes applied.'
                                  }
                                })()
                                : 'Changes applied.')}
                          </div>
                          {item.response.applied && item.response.applied.length > 0 && (
                            <div className="text-xs text-neutral-medium">
                              Applied: {item.response.applied.join(', ')}
                            </div>
                          )}
                          {item.response.executionMeta && (
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-neutral-low uppercase tracking-tight font-medium pt-1 opacity-70">
                              <span>Model: {item.response.executionMeta.model}</span>
                              <span>•</span>
                              <span>Turns: {item.response.executionMeta.totalTurns}</span>
                              <span>•</span>
                              <span>
                                Time: {(item.response.executionMeta.durationMs / 1000).toFixed(1)}s
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Label */}
            {!loadingAgentHistory && (
              <div className="space-y-2 pt-4">
                {agent.openEndedContext?.label && (
                  <div className="text-md font-medium text-neutral-high">
                    {agent.openEndedContext.label}
                  </div>
                )}
              </div>
            )}

            {/* Current Input */}
            <div className="space-y-2">
              <Textarea
                value={agentOpenEndedContext}
                onChange={(e) => setAgentOpenEndedContext(e.target.value)}
                placeholder={
                  agent.openEndedContext?.placeholder ||
                  'Example: "Rewrite this page for a more confident tone. Keep it under 500 words. Preserve the CTA."'
                }
                className="min-h-[120px]"
              />
              {agent.openEndedContext?.maxChars && (
                <div className="text-xs text-neutral-medium">
                  {agentOpenEndedContext.length}/{agent.openEndedContext.maxChars}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {/* Show user's request */}
            {agentOpenEndedContext && (
              <div className="space-y-1">
                <div className="text-xs text-neutral-medium">Your request:</div>
                <div className="bg-backdrop-medium p-3 rounded border border-neutral-border text-sm">
                  {agentOpenEndedContext}
                </div>
              </div>
            )}

            {/* Show AI's natural response */}
            {agentResponse.summary && (
              <div className="space-y-1">
                <div className="text-xs text-neutral-medium">AI Response:</div>
                <div className="bg-standout-low p-4 rounded-lg border border-standout-high text-sm whitespace-pre-wrap wrap-break-word">
                  {agentResponse.summary}
                </div>
              </div>
            )}
            {!agentResponse.summary && agentResponse.rawResponse && (
              <div className="space-y-1">
                <div className="text-xs text-neutral-medium">AI Response:</div>
                <div className="bg-standout-low p-4 rounded-lg border border-standout-high text-sm whitespace-pre-wrap wrap-break-word">
                  {(() => {
                    const raw = agentResponse.rawResponse
                    try {
                      const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
                      const jsonStr = jsonMatch ? jsonMatch[1] : raw
                      const parsed = JSON.parse(jsonStr)
                      if (parsed.summary && typeof parsed.summary === 'string') {
                        return parsed.summary
                      }
                      return 'Summary not available. Changes have been applied.'
                    } catch {
                      return raw
                    }
                  })()}
                </div>
              </div>
            )}

            {agentResponse.applied && agentResponse.applied.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-neutral-medium">Changes applied:</div>
                <div className="bg-success-light p-3 rounded border border-success-medium">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {agentResponse.applied.map((field, i) => (
                      <li key={i}>{field}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {agentResponse.executionMeta && (
              <div className="pt-2 border-t border-line-low mt-4">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-neutral-medium uppercase tracking-wider font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-low">Model:</span>
                    <span className="text-neutral-high">{agentResponse.executionMeta.model}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-low">Provider:</span>
                    <span className="text-neutral-high">
                      {agentResponse.executionMeta.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-low">Turns:</span>
                    <span className="text-neutral-high">
                      {agentResponse.executionMeta.totalTurns}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-low">Time:</span>
                    <span className="text-neutral-high">
                      {(agentResponse.executionMeta.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  {agentResponse.executionMeta.usage?.totalTokens > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-low">Tokens:</span>
                      <span className="text-neutral-high">
                        {agentResponse.executionMeta.usage.totalTokens.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {agentResponse.message && (
              <div className="text-sm text-success-medium font-medium">{agentResponse.message}</div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          {agentResponse ? (
            <>
              <AlertDialogCancel
                type="button"
                onClick={() => {
                  setAgentResponse(null)
                  setAgentOpenEndedContext('')
                  onOpenChange(false)
                }}
              >
                Close
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => {
                  setAgentResponse(null)
                  setAgentOpenEndedContext('')
                  onOpenChange(false)
                  // For post context, reload data
                  if (contextId && scope !== 'global') {
                    const targetMode = 'ai-review'
                    const url = new URL(window.location.href)
                    url.searchParams.set('view', targetMode)
                    window.history.replaceState({}, '', url.toString())
                    router.reload({
                      only: ['aiReviewDraft', 'post', 'modules'],
                      onSuccess: () => {
                        if (onSuccess) {
                          onSuccess(agentResponse)
                        }
                      },
                    })
                  } else {
                    if (onSuccess) {
                      onSuccess(agentResponse)
                    }
                  }
                }}
              >
                View Changes
              </AlertDialogAction>
            </>
          ) : (
            <>
              <AlertDialogCancel
                type="button"
                onClick={() => {
                  setAgentResponse(null)
                  setAgentOpenEndedContext('')
                  onOpenChange(false)
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                disabled={runningAgent || (scope !== 'global' && !contextId)}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  // Ensure modal stays open
                  if (!open) {
                    onOpenChange(true)
                  }
                  handleRunAgent()
                }}
              >
                {runningAgent ? 'Running…' : 'Run Agent'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
