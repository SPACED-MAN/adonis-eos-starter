/**
 * Global Agent Button
 *
 * Floating brain icon button in the lower right of the viewport
 * Opens agent modal for global-scoped agents
 */

import React, { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faBrain } from '@fortawesome/free-solid-svg-icons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { AgentModal, type Agent } from './AgentModal'
import { useHasPermission } from '~/utils/permissions'

export function GlobalAgentButton({
  variant = 'floating',
  permissions: manualPermissions,
}: {
  variant?: 'floating' | 'ghost'
  permissions?: string[]
}) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const hasPermissionHook = useHasPermission('agents.global')
  const hasGlobalPermission = manualPermissions
    ? manualPermissions.includes('agents.global')
    : hasPermissionHook

  // Load global-scoped agents
  useEffect(() => {
    if (!hasGlobalPermission) return
    let alive = true
      ; (async () => {
        try {
          const res = await fetch('/api/agents?scope=global', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) setAgents(list)
        } catch {
          if (alive) setAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [hasGlobalPermission])

  // Don't render if no permission or no agents
  if (!hasGlobalPermission || agents.length === 0) return null

  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent)
    setModalOpen(true)
    setPopoverOpen(false)
  }

  const isFloating = variant === 'floating'

  const trigger = isFloating ? (
    <button
      className="fixed bottom-0 right-0 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-standout-high text-on-high shadow-lg hover:bg-standout-high hover:scale-105 active:scale-95 transition-all duration-200"
      aria-label="AI Assistant"
    >
      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xl" />
    </button>
  ) : (
    <button
      className="px-3 py-2 text-xs font-medium text-neutral-high hover:bg-backdrop-medium transition-all"
      aria-label="AI Assistant"
    >
      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-standout-high" />
    </button>
  )

  return (
    <>
      <TooltipProvider>
        {agents.length === 1 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div onClick={() => handleAgentClick(agents[0])}>{trigger}</div>
            </TooltipTrigger>
            <TooltipContent side={isFloating ? 'left' : 'top'}>
              <p>AI Assistant ({agents[0].name})</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side={isFloating ? 'left' : 'top'}>
                <p>AI Assistants</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              side="top"
              align="end"
              className="w-64 p-2 mb-2 bg-backdrop-high border-line-medium shadow-2xl rounded-2xl overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-line-low mb-1">
                <h3 className="text-[10px] font-bold text-neutral-low uppercase tracking-widest">
                  Select AI Assistant
                </h3>
              </div>
              <div className="space-y-1">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentClick(agent)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-backdrop-medium text-left transition-colors group"
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-standout-high/10 flex items-center justify-center text-standout-high group-hover:bg-standout-high group-hover:text-on-high transition-colors">
                      <FontAwesomeIcon icon={faBrain} className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-neutral-high leading-tight">
                        {agent.name}
                      </div>
                      {agent.description && (
                        <div className="text-[11px] text-neutral-low line-clamp-2 mt-1 leading-snug">
                          {agent.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </TooltipProvider>

      {selectedAgent && (
        <AgentModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setSelectedAgent(null)
          }}
          agent={selectedAgent}
          contextId={undefined}
          context={{
            scope: 'global',
          }}
          scope="global"
          onSuccess={() => {
            // We don't close the modal immediately so the user can see the agent's response
            // and the generated media in the transcript.
          }}
        />
      )}
    </>
  )
}
