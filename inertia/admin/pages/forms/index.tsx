import { useMemo, useState } from 'react'
import { Head, router } from '@inertiajs/react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { toast } from 'sonner'

interface FormSubmissionSummary {
  id: string
  formSlug: string
  createdAt: string | null
  name?: string | null
  email?: string | null
  payload: Record<string, any>
}

interface FormDefinition {
  slug: string
  title: string
}

interface FormsIndexProps {
  forms: FormDefinition[]
  submissions: FormSubmissionSummary[]
}

export default function FormsIndex({ forms, submissions: initialSubmissions }: FormsIndexProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmissionSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const sortedSubmissions = useMemo(
    () => (initialSubmissions || []).slice().sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    }),
    [initialSubmissions]
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) return
    setIsDeleting(id)
    try {
      await router.delete(`/api/forms-submissions/${id}`, {
        onSuccess: () => {
          toast.success('Submission deleted')
          setSelectedSubmission(null)
        },
        onError: () => toast.error('Failed to delete submission'),
        onFinish: () => setIsDeleting(false)
      })
    } catch {
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Form Submissions" />
      <AdminHeader title="Form Submissions" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low border border-line-low rounded-lg">
          <div className="px-6 py-4 border-b border-line-low flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-high">Submissions</h2>
            <span className="text-xs text-neutral-low">
              Showing latest {sortedSubmissions.length} submissions
            </span>
          </div>
          <div className="p-6">
            {sortedSubmissions.length === 0 ? (
              <p className="text-sm text-neutral-medium italic">
                No submissions yet. Submissions from code-first forms will appear here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSubmissions.map((s) => (
                    <TableRow 
                      key={s.id} 
                      className="cursor-pointer hover:bg-backdrop-medium/40"
                      onClick={() => setSelectedSubmission(s)}
                    >
                      <TableCell className="text-neutral-high">
                        <span className="inline-flex items-center rounded-full bg-backdrop-medium px-2 py-0.5 text-xs font-mono">
                          {s.formSlug}
                        </span>
                      </TableCell>
                      <TableCell className="text-neutral-medium">
                        {s.name || <span className="text-neutral-low">—</span>}
                      </TableCell>
                      <TableCell className="text-neutral-medium">
                        {s.email || <span className="text-neutral-low">—</span>}
                      </TableCell>
                      <TableCell className="text-neutral-medium text-xs">
                        {s.createdAt ? (
                          new Date(s.createdAt).toLocaleString()
                        ) : (
                          <span className="text-neutral-low">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-neutral-low hover:text-danger"
                          onClick={() => handleDelete(s.id)}
                          disabled={isDeleting === s.id}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>

      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Form: <span className="font-mono">{selectedSubmission?.formSlug}</span> • {selectedSubmission?.createdAt && new Date(selectedSubmission.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 overflow-auto max-h-[60vh] p-1">
              {selectedSubmission && Object.entries(selectedSubmission.payload).map(([key, value]) => (
                <div key={key} className="border-b border-line-low pb-2 last:border-0">
                  <div className="text-[10px] font-bold text-neutral-low uppercase tracking-wider mb-1">{key}</div>
                  <div className="text-sm text-neutral-high whitespace-pre-wrap">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t border-line-low">
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
