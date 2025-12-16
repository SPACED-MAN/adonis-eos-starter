/**
 * Global Agent Button
 * 
 * Floating brain icon button in the lower right of the viewport
 * Opens agent modal for global-scoped agents
 */

import React, { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { AgentModal, type Agent } from './AgentModal'
import { useHasPermission } from '~/utils/permissions'

export function GlobalAgentButton() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const hasGlobalPermission = useHasPermission('agents.global')

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
    return () => { alive = false }
  }, [hasGlobalPermission])

  // Don't render if no permission or no agents
  if (!hasGlobalPermission || agents.length === 0) return null

  const handleClick = () => {
    if (agents.length === 1) {
      // Single agent - open directly
      setSelectedAgent(agents[0])
      setModalOpen(true)
    } else {
      // Multiple agents - show selection (for now, just open first)
      // TODO: Add agent selection UI
      setSelectedAgent(agents[0])
      setModalOpen(true)
    }
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary shadow-lg hover:bg-primary/90 transition-colors"
              aria-label="AI Assistant"
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-lg" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>AI Assistant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {selectedAgent && (
        <AgentModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          agent={selectedAgent}
          contextId={undefined} // Global scope doesn't need a post ID
          context={{
            scope: 'global',
          }}
          scope="global"
          onSuccess={() => {
            setModalOpen(false)
            setSelectedAgent(null)
          }}
        />
      )}
    </>
  )
}

