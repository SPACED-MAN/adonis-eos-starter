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

type WorkflowTrigger = {
  trigger: string
  enabled: boolean
}

type Workflow = {
  id: string
  name: string
  description: string
  type: string
  enabled: boolean
  triggers: WorkflowTrigger[]
}

export default function WorkflowsIndex() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  async function loadWorkflows() {
    setLoading(true)
    try {
      const res = await fetch('/api/workflows', { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      setWorkflows(Array.isArray(json?.data) ? json.data : [])
    } catch (error) {
      toast.error('Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkflows()
  }, [])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Workflows" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-high">System Workflows</h3>
            <p className="text-xs text-neutral-low">
              Workflows are automated tasks triggered by system events or webhooks.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Triggers</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-neutral-low">
                    Loading workflows...
                  </TableCell>
                </TableRow>
              ) : workflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-neutral-low">
                    No workflows found.
                  </TableCell>
                </TableRow>
              ) : (
                workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">{workflow.name}</TableCell>
                    <TableCell className="capitalize">{workflow.type}</TableCell>
                    <TableCell>
                      {workflow.enabled ? (
                        <span className="text-xs bg-success-low text-success-high px-2 py-1 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs bg-backdrop-medium text-neutral-low px-2 py-1 rounded">
                          Disabled
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {workflow.triggers.map((t, idx) => (
                          <span
                            key={idx}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              t.enabled
                                ? 'bg-standout-low text-standout-high border-standout-medium'
                                : 'bg-backdrop-low text-neutral-low border-line-low'
                            }`}
                          >
                            {t.trigger}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{workflow.description}</TableCell>
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
