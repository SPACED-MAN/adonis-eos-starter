import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import { toast } from 'sonner'

type Agent = {
  id: string
  name: string
  description: string
  type: string
  openEndedContext: {
    enabled: boolean
    label?: string
    placeholder?: string
    maxChars?: number
  }
  scopes: Array<{
    scope: string
    enabled: boolean
  }>
}

export default function AgentsIndex() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  async function loadAgents() {
    setLoading(true)
    try {
      const res = await fetch('/api/agents?scope=global', { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      setAgents(Array.isArray(json?.data) ? json.data : [])
    } catch (error) {
      toast.error('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAgents()
  }, [])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Agents" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-high">System Agents</h3>
            <p className="text-xs text-neutral-low">
              Agents are AI-powered tools that can help with content generation and editing.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-neutral-low">
                    Loading agents...
                  </TableCell>
                </TableRow>
              ) : agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-neutral-low">
                    No agents found.
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="capitalize">{agent.type}</TableCell>
                    <TableCell className="max-w-md">{agent.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {agent.scopes.map((s) => (
                          <span
                            key={s.scope}
                            className="text-[10px] bg-backdrop-medium text-neutral-medium px-1.5 py-0.5 rounded border border-line-low"
                          >
                            {s.scope}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {agent.openEndedContext.enabled ? (
                        <span className="text-[10px] bg-success-low text-success-high px-1.5 py-0.5 rounded border border-success-medium/20">
                          Open-ended
                        </span>
                      ) : (
                        <span className="text-[10px] bg-backdrop-medium text-neutral-low px-1.5 py-0.5 rounded">
                          Fixed
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}

