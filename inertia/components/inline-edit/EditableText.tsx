import { useEffect, useRef, useState } from 'react'
import { useInlineEditor, useInlineValue } from './InlineEditorContext'

type EditableTextProps = {
  value: string
  path: string
  moduleId?: string
  postId?: string
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  className?: string
}

export function EditableText({
  value,
  path,
  moduleId,
  postId,
  as: Tag = 'span',
  className,
}: EditableTextProps) {
  const editor = useInlineEditor()
  const { enabled, canEdit, postId: ctxPostId, setValue } = editor || {}
  const current = useInlineValue(moduleId, path, value)
  const [draft, setDraft] = useState(current)
  const [editing, setEditing] = useState(false)
  const editableRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setDraft(current)
  }, [current])

  useEffect(() => {
    if (editing) {
      if (editableRef.current) {
        editableRef.current.focus()
      }
    }
  }, [editing])

  const effectivePostId = postId || ctxPostId
  const effectiveModuleId = moduleId
  const canInlineEdit = enabled && canEdit && effectivePostId && effectiveModuleId

  function save(next: string) {
    if (!canInlineEdit || !setValue) return
    setValue(effectiveModuleId!, path, next)
    setEditing(false)
  }

  if (!canInlineEdit) {
    return <Tag className={className}>{current}</Tag>
  }

  if (!editing) {
    return (
      <Tag
        className={`${className ?? ''} cursor-text ${enabled ? 'outline outline-dashed outline-offset-2 outline-line-low' : ''}`}
        onDoubleClick={() => setEditing(true)}
      >
        {current}
      </Tag>
    )
  }

  return (
    <Tag
      ref={editableRef as any}
      contentEditable
      suppressContentEditableWarning
      className={`${className ?? ''} min-w-16 rounded border border-line-medium bg-backdrop-high text-neutral-high p-2`}
      onInput={() => {
        /* keep DOM text; avoid state thrash */
      }}
      onBlur={() => {
        const next = editableRef.current?.innerText ?? draft
        setDraft(next)
        save(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(e.shiftKey || e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          const next = editableRef.current?.innerText ?? draft
          setDraft(next)
          save(next)
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          const next = editableRef.current?.innerText ?? draft
          setDraft(next)
          save(next)
        } else if (e.key === 'Escape') {
          setDraft(current)
          setEditing(false)
        }
      }}
      dangerouslySetInnerHTML={{ __html: draft ? draft.replace(/\n/g, '<br/>') : '' }}
    />
  )
}
