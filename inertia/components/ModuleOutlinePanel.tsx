import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGripVertical,
  faPlus,
  faTrash,
  faEye,
  faPencil,
  faClone,
} from '@fortawesome/free-solid-svg-icons'
import { ModulePicker } from '../admin/components/modules/ModulePicker'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface Module {
  id: string
  type: string
  name?: string
  label?: string | null
  adminLabel?: string | null
  globalSlug?: string | null
  globalLabel?: string | null
}

interface ModuleOutlinePanelProps {
  modules: Module[]
  postType: string
  postId?: string
  onReorder: (modules: Module[]) => void
  onAddModule: (payload: {
    type: string
    name?: string
    scope: 'post' | 'global'
    globalSlug?: string | null
  }) => void
  onRemoveModule: (moduleId: string) => void
  onUpdateLabel: (moduleId: string, label: string | null) => void
  onDuplicateModule: (moduleId: string) => void
  onClose: () => void
}

function SortableModuleItem({
  module,
  onRemove,
  onJump,
  onUpdateLabel,
  onDuplicate,
}: {
  module: Module
  onRemove: (id: string) => void
  onJump: (id: string) => void
  onUpdateLabel: (id: string, label: string | null) => void
  onDuplicate: (id: string) => void
}) {
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editValue, setEditValue] = useState(module.adminLabel || '')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
    disabled: isEditingLabel,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  }

  const displayName =
    module.globalLabel ||
    module.adminLabel ||
    module.label ||
    (module.name && module.name !== module.type ? module.name : null) ||
    module.type
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  const handleLabelSubmit = () => {
    onUpdateLabel(module.id, editValue.trim() || null)
    setIsEditingLabel(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 p-3 bg-backdrop-high border-b border-line-low hover:bg-backdrop-medium transition-colors ${
        isDragging
          ? 'shadow-xl rounded-lg border border-standout-high ring-2 ring-standout-high/20'
          : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing text-neutral-low hover:text-neutral-medium p-1 -ml-1 ${isEditingLabel ? 'opacity-20 pointer-events-none' : ''}`}
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </div>

      <div className="flex-1 min-w-0">
        {isEditingLabel ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className="flex-1 bg-backdrop-low border border-line-medium rounded px-2 py-1 text-sm text-neutral-high focus:outline-none focus:ring-1 focus:ring-standout-high"
              onBlur={handleLabelSubmit}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSubmit()
                if (e.key === 'Escape') setIsEditingLabel(false)
              }}
              value={editValue}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 group/label min-w-0">
            <div className="text-sm font-semibold text-neutral-high truncate">{displayName}</div>
            {(module.adminLabel || module.label) && (
              <span className="text-[10px] text-neutral-medium italic shrink-0">
                ({module.name || module.type})
              </span>
            )}
            <button
              className="opacity-0 group-hover/label:opacity-100 p-1 text-neutral-low hover:text-neutral-high transition-opacity shrink-0"
              onClick={() => {
                setEditValue(module.adminLabel || '')
                setIsEditingLabel(true)
              }}
              title="Edit label"
            >
              <FontAwesomeIcon icon={faPencil} size="xs" />
            </button>
          </div>
        )}
        <div className="text-[10px] text-neutral-low uppercase tracking-wider flex items-center gap-2">
          {module.type}
          {module.globalSlug && (
            <span className="px-1.5 py-0.5 rounded bg-standout-high/10 text-standout-high font-bold">
              Global
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="p-1.5 text-neutral-low hover:text-standout-high hover:bg-standout-high/10 rounded-md transition-colors"
              onClick={() => onJump(module.id)}
            >
              <FontAwesomeIcon icon={faEye} size="sm" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Jump to module</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="p-1.5 text-neutral-low hover:text-standout-high hover:bg-standout-high/10 rounded-md transition-colors"
              onClick={() => onDuplicate(module.id)}
            >
              <FontAwesomeIcon icon={faClone} size="sm" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Duplicate module</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="p-1.5 text-neutral-low hover:text-error hover:bg-error/10 rounded-md transition-colors"
              onClick={() => onRemove(module.id)}
            >
              <FontAwesomeIcon icon={faTrash} size="sm" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove module</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export function ModuleOutlinePanel({
  modules,
  postType,
  postId,
  onReorder,
  onAddModule,
  onRemoveModule,
  onUpdateLabel,
  onDuplicateModule,
  onClose,
}: ModuleOutlinePanelProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id)
      const newIndex = modules.findIndex((m) => m.id === over.id)
      onReorder(arrayMove(modules, oldIndex, newIndex))
    }
  }

  const handleJumpToModule = (id: string) => {
    const el = document.querySelector(`[data-inline-module="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-4', 'ring-standout-high', 'ring-offset-4', 'transition-all', 'duration-500')
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-standout-high', 'ring-offset-4')
      }, 2000)
    }
  }

  const activeModule = activeId ? modules.find((m) => m.id === activeId) : null

  return (
    <div className="flex flex-col h-full bg-backdrop-high">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-low">
        <div>
          <h2 className="text-sm font-bold text-neutral-high">Page Outline</h2>
          <p className="text-[10px] text-neutral-low uppercase tracking-wider">
            {modules.length} {modules.length === 1 ? 'Module' : 'Modules'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {modules.map((m) => (
                <SortableModuleItem
                  key={m.id}
                  module={m}
                  onRemove={onRemoveModule}
                  onJump={handleJumpToModule}
                  onUpdateLabel={onUpdateLabel}
                  onDuplicate={onDuplicateModule}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.5',
                  },
                },
              }),
            }}
          >
            {activeId && activeModule ? (
              <div className="flex items-center gap-3 p-3 bg-backdrop-high border border-standout-high rounded-lg shadow-2xl ring-2 ring-standout-high/20 w-[425px]">
                <div className="text-neutral-medium p-1">
                  <FontAwesomeIcon icon={faGripVertical} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-high truncate">
                    {activeModule.globalLabel ||
                      activeModule.adminLabel ||
                      activeModule.label ||
                      (activeModule.name && activeModule.name !== activeModule.type
                        ? activeModule.name
                        : null) ||
                      activeModule.type
                        .split('-')
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {modules.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-backdrop-low flex items-center justify-center mb-4">
              <FontAwesomeIcon icon={faPlus} className="text-neutral-low" />
            </div>
            <p className="text-sm text-neutral-medium">No modules on this page yet.</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-line-low bg-backdrop-low">
        <ModulePicker
          postType={postType}
          postId={postId}
          onAdd={async (payload) => {
            onAddModule(payload)
          }}
          buttonLabel="Add New Module"
        />
      </div>
    </div>
  )
}

