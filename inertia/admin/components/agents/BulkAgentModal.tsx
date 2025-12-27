/**
 * Bulk Agent Modal Component
 *
 * Provides an interface to run an agent on multiple posts.
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

export interface AgentHistoryItem {
  id: string
  request: string | null
  response: {
    rawResponse?: string
    summary?: string
    applied?: string[]
    [key: string]: any
  } | null
  createdAt: string
  user: { id: number; email: string; fullName: string | null } | null
}

type BulkAgentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: Agent | null
  postIds: string[]
  onSuccess?: () => void
}

export function BulkAgentModal({
  open,
  onOpenChange,
  agent,
  postIds,
  onSuccess,
}: BulkAgentModalProps) {
  const [runningAgent, setRunningAgent] = useState(false)
  const [agentOpenEndedContext, setAgentOpenEndedContext] = useState('')
  const [agentResults, setAgentResults] = useState<any[] | null>(null)
  const [agentHistory, setAgentHistory] = useState<AgentHistoryItem[]>([])
  const [loadingAgentHistory, setLoadingAgentHistory] = useState(false)
  const modalContentRef = useRef<HTMLDivElement | null>(null)

  // Load agent history for posts.bulk scope
  useEffect(() => {
    if (!open || !agent) {
      setAgentHistory([])
      return
    }
    let alive = true
    async function loadHistory() {
      try {
        setLoadingAgentHistory(true)
        const res = await fetch(`/api/agents/${agent!.id}/history?scope=posts.bulk`, {
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
  }, [open, agent?.id])

  const handleRunAgent = async () => {
    if (!agent || postIds.length === 0) return

    setRunningAgent(true)
    setAgentResults(null)

    try {
      const csrf = (() => {
        if (typeof document === 'undefined') return undefined
        const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      })()

      const res = await fetch(`/api/posts/bulk-agents/${encodeURIComponent(agent.id)}/run`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          ids: postIds,
          openEndedContext: agentOpenEndedContext.trim() || undefined,
        }),
      })

      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        setAgentResults(j.results || [])
        toast.success(`Agent completed for ${postIds.length} posts`)
        if (onSuccess) onSuccess()
      } else {
        toast.error(j?.error || 'Bulk agent run failed')
      }
    } catch (error: any) {
      console.error('Bulk agent execution error:', error)
      toast.error('Bulk agent run failed')
    } finally {
      setRunningAgent(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if ((runningAgent || agentResults) && !newOpen) return
    onOpenChange(newOpen)
    if (!newOpen) {
      setAgentResults(null)
      setAgentOpenEndedContext('')
    }
  }

  if (!agent) return null

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent ref={modalContentRef} className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {agentResults ? 'Bulk Agent Results' : `Run ${agent.name} on ${postIds.length} posts`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {agentResults
              ? 'Summary of actions performed on selected posts.'
              : agent.description || 'Provide instructions for the AI agent to execute.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {runningAgent ? (
          <div className="mt-3 space-y-4">
            <div className="flex items-center gap-3">
              <Spinner className="size-5 text-primary" />
              <div className="text-sm font-medium">Running agent on {postIds.length} posts...</div>
            </div>
            <div className="text-xs text-neutral-medium">
              This may take a moment depending on the number of posts.
            </div>
          </div>
        ) : !agentResults ? (
          <div className="mt-3 space-y-4">
            {/* History */}
            {loadingAgentHistory ? (
              <Spinner className="size-4" />
            ) : agentHistory.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 border-b border-line-low pb-4 mb-4">
                <div className="text-xs font-bold text-neutral-low uppercase tracking-wider">
                  Recent Bulk History
                </div>
                {[...agentHistory]
                  .reverse()
                  .slice(0, 5)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="text-xs p-2 bg-backdrop-medium rounded border border-line-low"
                    >
                      <div className="font-medium text-neutral-high mb-1">
                        {item.request || 'No instructions'}
                      </div>
                      <div className="text-neutral-medium italic">
                        {item.response?.summary || 'Completed'}
                      </div>
                      <div className="text-[10px] text-neutral-low mt-1">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}

            <div className="space-y-2">
              {agent.openEndedContext?.label && (
                <div className="text-sm font-medium text-neutral-high">
                  {agent.openEndedContext.label}
                </div>
              )}
              <Textarea
                value={agentOpenEndedContext}
                onChange={(e) => setAgentOpenEndedContext(e.target.value)}
                placeholder={
                  agent.openEndedContext?.placeholder ||
                  'What do you want the agent to do with these posts?'
                }
                className="min-h-[120px]"
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="divide-y divide-line-low border border-line-low rounded-lg overflow-hidden">
              {agentResults.map((res) => (
                <div key={res.id} className="p-3 text-xs flex items-center justify-between">
                  <div className="font-mono text-neutral-medium truncate mr-4" title={res.id}>
                    ID: {res.id.substring(0, 8)}...
                  </div>
                  <div className="flex-1">
                    {res.success ? (
                      <div className="text-success-high font-medium">
                        {res.result?.summary || 'Success'}
                      </div>
                    ) : (
                      <div className="text-red-500 font-medium">Error: {res.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          {agentResults ? (
            <AlertDialogAction onClick={() => onOpenChange(false)}>Close</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={runningAgent || postIds.length === 0}
                onClick={(e) => {
                  e.preventDefault()
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
