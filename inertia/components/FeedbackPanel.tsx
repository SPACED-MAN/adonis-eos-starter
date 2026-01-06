import React, { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMessage,
  faCheck,
  faTrash,
  faLocationArrow,
  faXmark,
  faPlus,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'

import { getXsrf } from '~/utils/xsrf'
// ... rest of imports

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

type Feedback = {
  id: string
  postId: string
  userId: number | null
  mode: 'approved' | 'review' | 'ai-review'
  content: string
  type: string
  status: 'pending' | 'resolved'
  context: any
  createdAt: string
  user?: {
    id: number
    username: string
    email: string
  }
}

interface FeedbackPanelProps {
  postId: string
  mode: 'approved' | 'review' | 'ai-review'
  onClose?: () => void
  onJumpToSpot?: (context: any, feedbackId: string) => void
  onSelect?: (id: string) => void
  initialContext?: any
  highlightId?: string | null
}

export function FeedbackPanel({
  postId,
  mode,
  onClose,
  onJumpToSpot,
  onSelect,
  initialContext,
  highlightId,
}: FeedbackPanelProps) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [newFeedbackContent, setNewFeedbackContent] = useState('')
  const [newFeedbackType, setNewFeedbackType] = useState('comment')
  const [isAdding, setIsAdding] = useState(false)
  const [pendingContext, setPendingContext] = useState<any>(initialContext)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`feedback-${highlightId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-standout-high')
        setTimeout(() => el.classList.remove('ring-2', 'ring-standout-high'), 2000)
      }
    }
  }, [highlightId, feedbacks])

  useEffect(() => {
    if (initialContext) {
      setPendingContext(initialContext)
    }
  }, [initialContext])

  const fetchFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/feedbacks?postId=${postId}&mode=${mode}`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setFeedbacks(data)
      }
    } catch (error) {
      console.error('Failed to fetch feedbacks', error)
    } finally {
      setLoading(false)
    }
  }, [postId, mode])

  useEffect(() => {
    fetchFeedbacks()
  }, [fetchFeedbacks])

  const handleAddFeedback = async () => {
    if (!newFeedbackContent.trim()) return
    setIsAdding(true)
    try {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': getXsrf() || '',
        },
        body: JSON.stringify({
          postId,
          mode,
          content: newFeedbackContent,
          type: newFeedbackType,
          context: pendingContext,
        }),
      })

      if (res.ok) {
        toast.success('Feedback added')
        setNewFeedbackContent('')
        setPendingContext(null)
        fetchFeedbacks()
        // Notify other components (like SiteAdminBar) to refresh
        window.dispatchEvent(new CustomEvent('feedback:created'))
      } else {
        toast.error('Failed to add feedback')
      }
    } catch (error) {
      toast.error('Error adding feedback')
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggleStatus = async (feedback: Feedback) => {
    const newStatus = feedback.status === 'pending' ? 'resolved' : 'pending'
    try {
      const res = await fetch(`/api/feedbacks/${feedback.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': getXsrf() || '',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === feedback.id ? { ...f, status: newStatus } : f))
        )
        toast.success(`Feedback marked as ${newStatus}`)
      }
    } catch (error) {
      toast.error('Failed to update feedback status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/feedbacks/${id}`, {
        method: 'DELETE',
        headers: {
          'X-XSRF-TOKEN': getXsrf() || '',
        },
      })
      if (res.ok) {
        setFeedbacks((prev) => prev.filter((f) => f.id !== id))
        toast.success('Feedback deleted')
      }
    } catch (error) {
      toast.error('Failed to delete feedback')
    } finally {
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-backdrop-high">
      <div className="flex items-center justify-between p-4 border-b border-line-low">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <FontAwesomeIcon icon={faMessage} className="text-standout-high" />
          Feedback
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <FontAwesomeIcon icon={faSpinner} spin className="text-neutral-medium" />
          </div>
        ) : feedbacks.length === 0 ? (
          <p className="text-center text-sm text-neutral-low py-8">
            No feedback yet for this version.
          </p>
        ) : (
          feedbacks.map((f) => (
            <div
              key={f.id}
              id={`feedback-${f.id}`}
              onClick={() => {
                if (onSelect) onSelect(f.id)
                if (f.context && onJumpToSpot) {
                  let ctx = f.context
                  if (typeof ctx === 'string') {
                    try {
                      ctx = JSON.parse(ctx)
                    } catch (e) {}
                  }
                  onJumpToSpot(ctx, f.id)
                }
              }}
              className={`p-3 rounded-xl border transition-all duration-500 ${f.status === 'resolved' ? 'bg-backdrop-medium/20 border-line-low opacity-60' : 'bg-backdrop-low border-line-medium'} space-y-2 ${f.context ? 'cursor-pointer hover:border-standout-high/50 group' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={f.type === 'bug' ? 'destructive' : 'secondary'}
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {f.type}
                    </Badge>
                    <span className="text-[10px] text-neutral-low">
                      {new Date(f.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-neutral-medium">
                    {f.user?.username || f.user?.email || 'System'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {f.context && onJumpToSpot && (
                    <div
                      className="p-1.5 text-neutral-low group-hover:text-standout-high transition-colors"
                      title="Jump to spot"
                    >
                      <FontAwesomeIcon icon={faLocationArrow} size="xs" />
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleStatus(f)
                    }}
                    className={`p-1.5 transition-colors ${f.status === 'resolved' ? 'text-green-500' : 'text-neutral-low hover:text-green-500'}`}
                    title={f.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  >
                    <FontAwesomeIcon icon={faCheck} size="xs" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmId(f.id)
                    }}
                    className="p-1.5 text-neutral-low hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} size="xs" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-neutral-high whitespace-pre-wrap">{f.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-line-low space-y-3 bg-backdrop-low">
        <div className="flex items-center justify-between gap-2">
          <Select value={newFeedbackType} onValueChange={setNewFeedbackType}>
            <SelectTrigger className="h-8 text-[10px] w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comment">Comment</SelectItem>
              <SelectItem value="copy">Copy Edit</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
            </SelectContent>
          </Select>
          {pendingContext?.selector && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-standout-high/10 text-standout-high text-[10px] font-bold">
              <FontAwesomeIcon icon={faLocationArrow} size="xs" />
              Linked to spot
              <button
                onClick={() => setPendingContext(null)}
                className="ml-1 hover:text-standout-high"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          )}
        </div>
        <Textarea
          placeholder="Add your feedback..."
          value={newFeedbackContent}
          onChange={(e) => setNewFeedbackContent(e.target.value)}
          className="text-sm min-h-[80px] resize-none"
        />
        <button
          onClick={handleAddFeedback}
          disabled={isAdding || !newFeedbackContent.trim()}
          className="w-full py-2 bg-standout-high text-on-high rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isAdding ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
          Add Feedback
        </button>
      </div>

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
