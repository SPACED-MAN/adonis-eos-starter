import { useState } from 'react'
import { MediaPickerModal } from '../../admin/components/media/MediaPickerModal'
import { useInlineEditor } from './InlineEditorContext'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

type EditableImageProps = {
  children: (opts: { open: () => void }) => JSX.Element
  path: string
  moduleId?: string
  postId?: string
  title?: string
}

export function EditableImage({ children, path, moduleId, postId, title }: EditableImageProps) {
  const { enabled, canEdit, postId: ctxPostId, setValue } = useInlineEditor()
  const [open, setOpen] = useState(false)
  const effectivePostId = postId || ctxPostId
  const canInlineEdit = enabled && canEdit && moduleId && effectivePostId

  function save(mediaId: string) {
    if (!canInlineEdit) return
    setValue(moduleId!, path, mediaId)
  }

  if (!canInlineEdit) {
    return children({ open: () => {} })
  }

  return (
    <>
      <div className="relative group">
        {children({ open: () => setOpen(true) })}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Edit media"
              onClick={() => setOpen(true)}
              className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-backdrop-high/90 border border-line-medium text-neutral-high p-2 shadow hover:bg-backdrop-medium opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✏️
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{title || 'Edit media'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <MediaPickerModal
        open={open}
        onOpenChange={setOpen}
        onSelect={(item) => {
          save(item.id)
          setOpen(false)
        }}
        allowUpload
        title="Select media"
      />
    </>
  )
}
