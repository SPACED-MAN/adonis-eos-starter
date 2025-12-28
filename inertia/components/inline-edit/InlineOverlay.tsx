import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import {
  faCheck,
  faChevronDown,
  faCircleQuestion,
  faArrowUp,
  faArrowDown,
  faTrash,
  faPlus,
  faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { MediaPickerModal } from '../../admin/components/media/MediaPickerModal'
import { useInlineEditor } from './InlineEditorContext'
import { LinkField, type LinkFieldValue } from '../forms/LinkField'
import { LexicalEditor } from '../../admin/components/LexicalEditor'
import { FontAwesomeIcon } from '../../site/lib/icons'
import { iconOptions } from '../../admin/components/ui/iconOptions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { EditablePostReference } from './EditablePostReference'

type HandlerCleanup = () => void

type ObjectField = {
  name: string
  type: string
  label: string
  options?: Array<{ label: string; value: any }>
}

type PopoverState = {
  moduleId: string
  path: string
  type: string
  label?: string
  postType?: string
  options?: Array<{ label: string; value: any }>
  multi?: boolean
  fields?: ObjectField[]
}

export function InlineOverlay() {
  const { enabled, canEdit, getValue, getModeValue, setValue, mode, isGlobalModule, showDiffs } =
    useInlineEditor()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [mediaTarget, setMediaTarget] = useState<{ moduleId: string; path: string } | null>(null)
  const [dialogState, setDialogState] = useState<PopoverState | null>(null)

  function resolveModuleId(el: HTMLElement | null): string | undefined {
    if (!el) return undefined
    return (
      el.dataset.inlineModule ||
      (el.closest('[data-inline-module]') as HTMLElement | null)?.dataset.inlineModule
    )
  }
  function isGlobalModuleDom(
    el: HTMLElement | null,
    fallbackCheck?: (moduleId: string) => boolean
  ): boolean {
    const mod = el?.closest('[data-inline-module]') as HTMLElement | null
    if (!mod) return false

    const moduleId = mod.dataset.inlineModule
    const scope = mod.dataset.inlineScope
    const slug = mod.dataset.inlineGlobalSlug

    const domFlag = scope === 'global' || scope === 'static' || !!slug
    if (domFlag) return true

    if (moduleId && fallbackCheck) return fallbackCheck(moduleId)
    return false
  }

  // Simple word-level diff: returns HTML with spans for insertions/deletions
  function renderWordDiffHtml(base: string, target: string): string {
    const baseWords = base.split(/(\s+)/) // keep spaces as tokens
    const targetWords = target.split(/(\s+)/)
    const out: string[] = []
    let i = 0
    let j = 0
    while (i < baseWords.length || j < targetWords.length) {
      const bw = baseWords[i] ?? ''
      const tw = targetWords[j] ?? ''
      if (bw === tw) {
        out.push(escapeHtml(tw))
        i++
        j++
        continue
      }
      // If next target matches current base, treat target[j] as insertion
      if (bw && targetWords[j + 1] === bw) {
        out.push(`<span class="inline-diff-add">${escapeHtml(tw)}</span>`)
        j++
        continue
      }
      // If next base matches current target, treat base[i] as deletion
      if (tw && baseWords[i + 1] === tw) {
        const display = bw.trim() === '' ? '&nbsp;' : escapeHtml(bw)
        out.push(`<span class="inline-diff-del">${display}</span>`)
        i++
        continue
      }
      // Fallback: replace
      if (tw) out.push(`<span class="inline-diff-add">${escapeHtml(tw)}</span>`)
      if (bw) {
        const display = bw.trim() === '' ? '&nbsp;' : escapeHtml(bw)
        out.push(`<span class="inline-diff-del">${display}</span>`)
      }
      i++
      j++
    }
    return out.join('')
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // Attach inline editors to elements marked with data-inline-path
  useEffect(() => {
    if (!canEdit || !enabled || typeof document === 'undefined') return

    const cleanups: HandlerCleanup[] = []

    // Global module notice + outline + disable editing
    const moduleNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-inline-module]'))
    moduleNodes.forEach((modEl) => {
      const moduleId = modEl.dataset.inlineModule
      if (
        !(
          modEl.dataset.inlineScope === 'global' ||
          modEl.dataset.inlineGlobalSlug ||
          (moduleId && isGlobalModule(moduleId))
        )
      )
        return
      modEl.classList.add('inline-global-module')
      const onEnterMod = () => modEl.classList.add('inline-edit-hover')
      const onLeaveMod = () => modEl.classList.remove('inline-edit-hover')
      modEl.addEventListener('mouseenter', onEnterMod)
      modEl.addEventListener('mouseleave', onLeaveMod)
      cleanups.push(() => {
        modEl.removeEventListener('mouseenter', onEnterMod)
        modEl.removeEventListener('mouseleave', onLeaveMod)
        modEl.classList.remove('inline-edit-hover')
        modEl.classList.remove('inline-global-module')
      })
      if (modEl.querySelector('.inline-global-indicator')) return
      const badge = document.createElement('div')
      badge.className =
        'inline-global-indicator mb-3 flex items-center justify-end gap-2 text-xs text-neutral-high bg-backdrop-high border border-line-medium rounded px-3 py-2'
      const labelText =
        modEl.dataset.inlineGlobalLabel || modEl.dataset.inlineGlobalSlug || 'Global module'
      const link = document.createElement('a')
      const slug = modEl.dataset.inlineGlobalSlug
      link.href = `/admin/modules?tab=globals${slug ? `&editSlug=${encodeURIComponent(slug)}` : ''}`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.className =
        'inline-flex items-center gap-1 text-standout-high hover:underline font-medium'
      link.title = `Edit ${labelText} (opens in new tab)`
      link.setAttribute('aria-label', `Edit ${labelText} (opens in new tab)`)
      // Render icon client-side instead of using renderToStaticMarkup
      const iconContainer = document.createElement('span')
      iconContainer.className = 'w-4 h-4'
      const root = createRoot(iconContainer)
      root.render(<FontAwesomeIcon icon="globe" className="w-4 h-4" />)
      const textSpan = document.createElement('span')
      textSpan.textContent = `Edit ${labelText}`
      link.appendChild(iconContainer)
      link.appendChild(textSpan)
      link.title = `Edit ${labelText} (opens in new tab)`
      link.setAttribute('aria-label', `Edit ${labelText} (opens in new tab)`)
      badge.appendChild(link)
      modEl.prepend(badge)
      cleanups.push(() => badge.remove())
    })

    const textNodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-inline-path][data-inline-type="text"], [data-inline-path]:not([data-inline-type])'
      )
    )

    textNodes.forEach((el) => {
      if (isGlobalModuleDom(el, isGlobalModule)) return

      // DEFENSE: If no explicit type, only treat as text if it doesn't have complex HTML children.
      // This prevents containers with data-inline-path="someProp" from being wiped.
      if (!el.dataset.inlineType && el.children.length > 0) {
        return
      }

      const path = el.dataset.inlinePath
      const moduleId = resolveModuleId(el)
      if (!path || !moduleId) return
      // Skip text elements that are children of link/select/icon fields (they're part of the parent control)
      if (
        el.closest(
          '[data-inline-type="link"], [data-inline-type="select"], [data-inline-type="icon"], [data-inline-type="multiselect"]'
        )
      ) {
        return
      }
      const onEnter = () => el.classList.add('inline-edit-hover')
      const onLeave = () => el.classList.remove('inline-edit-hover')
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
        el.classList.remove('inline-edit-hover')
        el.removeAttribute('data-inline-diff-active')
      })

      // set initial text from context (merge props/overrides + drafts)
      const current = getValue(moduleId, path, el.innerText || '')
      const asString = typeof current === 'string' ? current : String(current ?? '')
      const baselineMode = mode === 'review' ? 'source' : mode === 'ai-review' ? 'review' : null
      if (showDiffs && baselineMode) {
        const baselineVal = getModeValue(moduleId, path, baselineMode as any, asString)
        const baselineStr =
          typeof baselineVal === 'string' ? baselineVal : String(baselineVal ?? '')
        const diffHtml = renderWordDiffHtml(baselineStr, asString)
        el.innerHTML = diffHtml
        el.contentEditable = 'false'
        el.removeAttribute('data-inline-active')
        el.dataset.inlineDiffActive = '1'
      } else {
        if (el.innerText !== asString) {
          el.innerText = asString
        }
        el.contentEditable = 'true'
        el.removeAttribute('data-inline-diff-active')
      }

      if (enabled) {
        const onInput = () => {
          // keep DOM text only; save on blur/Enter
        }
        const onBlur = () => {
          const next = el.innerText
          setValue(moduleId, path, next)
        }
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Enter' && !(e.shiftKey || e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            const next = el.innerText
            setValue(moduleId, path, next)
            el.blur()
          }
          if (e.key === 'Escape') {
            const base = getValue(moduleId, path, el.innerText || '')
            el.innerText = typeof base === 'string' ? base : String(base ?? '')
            el.blur()
          }
        }

        el.contentEditable = 'true'
        el.dataset.inlineActive = '1'
        el.addEventListener('input', onInput)
        el.addEventListener('blur', onBlur)
        el.addEventListener('keydown', onKeyDown)

        cleanups.push(() => {
          el.removeEventListener('input', onInput)
          el.removeEventListener('blur', onBlur)
          el.removeEventListener('keydown', onKeyDown)
          el.removeAttribute('contenteditable')
          el.removeAttribute('data-inline-active')
        })
      } else {
        // ensure not editable when disabled
        el.removeAttribute('contenteditable')
        el.removeAttribute('data-inline-active')
      }
    })

    // Media fields: attach pencil button
    const mediaNodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-inline-type="media"][data-inline-path]')
    )

    mediaNodes.forEach((el) => {
      if (isGlobalModuleDom(el, isGlobalModule)) return
      const path = el.dataset.inlinePath
      const moduleId = resolveModuleId(el)
      if (!path || !moduleId) return
      const onEnter = () => el.classList.add('inline-edit-hover')
      const onLeave = () => el.classList.remove('inline-edit-hover')
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
        el.classList.remove('inline-edit-hover')
        el.classList.remove('inline-diff-review')
        el.classList.remove('inline-diff-ai')
      })

      // only add pencil when enabled
      if (enabled) {
        if (el.querySelector('.inline-media-pencil')) return
        if (!el.style.position) el.style.position = 'relative'

        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className =
          'inline-media-pencil absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-backdrop-high/90 border border-line-medium text-neutral-high p-2 shadow hover:bg-backdrop-medium'
        btn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="w-4 h-4 fill-current"><path d="M410.3 45.25c-16.97-16.97-44.56-16.97-61.53 0L318.6 75.41l118 118l30.17-30.17c16.97-16.97 16.97-44.56 0-61.53L410.3 45.25zM289.4 104.6L65.89 328.1c-6.13 6.13-10.42 13.7-12.62 22L1.055 488.1C-1.238 496.7 6.262 504.2 14.92 501.9l137.9-52.21c8.32-2.2 15.89-6.49 22.02-12.62l223.5-223.5L289.4 104.6z"/></svg>'
        btn.onclick = () => setMediaTarget({ moduleId, path })
        el.appendChild(btn)

        cleanups.push(() => {
          btn.remove()
        })
      } else {
        // remove any existing pencil when disabled
        const btn = el.querySelector('.inline-media-pencil')
        if (btn) btn.remove()
      }
    })

    // Richtext fields (open Lexical dialog)
    const richtextNodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-inline-type="richtext"][data-inline-path]')
    )
    richtextNodes.forEach((el) => {
      if (isGlobalModuleDom(el, isGlobalModule)) return
      const path = el.dataset.inlinePath
      const moduleId = resolveModuleId(el)
      if (!path || !moduleId) return
      const onEnter = () => el.classList.add('inline-edit-hover')
      const onLeave = () => el.classList.remove('inline-edit-hover')
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
        el.classList.remove('inline-edit-hover')
      })
      const label = el.dataset.inlineLabel
      const handler = (e: Event) => {
        if (!enabled) return
        e.preventDefault()
        e.stopPropagation()
        setDialogState({
          moduleId,
          path,
          type: 'richtext',
          label,
        })
      }
      el.addEventListener('click', handler)
      cleanups.push(() => el.removeEventListener('click', handler))
    })

    // Other field types (click to open popover)
    const otherNodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-inline-type]:not([data-inline-type="media"]):not([data-inline-type="text"]):not([data-inline-type="richtext"])'
      )
    )
    otherNodes.forEach((el) => {
      if (isGlobalModuleDom(el, isGlobalModule)) return
      const path = el.dataset.inlinePath
      const moduleId = resolveModuleId(el)
      const type = (el.dataset.inlineType || '').toLowerCase()
      if (!path || !moduleId || !type) return
      const onEnter = () => el.classList.add('inline-edit-hover')
      const onLeave = () => el.classList.remove('inline-edit-hover')
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
        el.classList.remove('inline-edit-hover')
      })
      const optionsAttr = el.dataset.inlineOptions
      let options: Array<{ label: string; value: any }> | undefined
      if (optionsAttr) {
        try {
          const parsed = JSON.parse(optionsAttr)
          if (Array.isArray(parsed)) {
            options = parsed.map((o: any) =>
              typeof o === 'object' && o !== null
                ? { label: o.label ?? String(o.value ?? o), value: o.value ?? o.label ?? o }
                : { label: String(o), value: o }
            )
          }
        } catch {
          /* ignore */
        }
      }
      // Parse object fields schema
      const fieldsAttr = el.dataset.inlineFields
      let fields: ObjectField[] | undefined
      if (fieldsAttr) {
        try {
          const parsed = JSON.parse(fieldsAttr)
          if (Array.isArray(parsed)) {
            fields = parsed
          }
        } catch {
          /* ignore */
        }
      }
      const postType = el.dataset.inlinePostType
      const multi = el.dataset.inlineMulti === 'true'
      const label = el.dataset.inlineLabel
      const handler = (e: Event) => {
        if (!enabled) return
        e.preventDefault()
        e.stopPropagation() // prevent navigation for anchor tags
        setDialogState({
          moduleId,
          path,
          type,
          label,
          postType,
          options,
          multi,
          fields,
        })
      }
      el.addEventListener('click', handler)
      cleanups.push(() => el.removeEventListener('click', handler))
    })

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [enabled, canEdit, getValue, getModeValue, setValue, mode, showDiffs, isGlobalModule])

  // Detach when disabled
  useEffect(() => {
    if (enabled) return
    if (typeof document === 'undefined') return
    const active = Array.from(document.querySelectorAll('[data-inline-active]'))
    active.forEach((el) => {
      el.removeAttribute('contenteditable')
      el.removeAttribute('data-inline-active')
    })
  }, [enabled])

  if (!mounted || !canEdit) return null

  return createPortal(
    <>
      <style>{`
        [data-inline-active="1"],
        [data-inline-path].inline-edit-hover {
          outline: 1px dashed var(--inline-edit-accent, #5c7cfa);
          outline-offset: 2px;
        }
        .inline-global-module.inline-edit-hover {
          outline: 2px solid var(--color-line-inline-input-global, #f97316);
          outline-offset: 6px;
        }
        
        /* Empty field placeholders */
        [data-inline-path]:empty::before,
        [data-inline-type="richtext"]:empty::before,
        [data-inline-type="media"]:empty::before {
          content: "Enter " attr(data-inline-label) "...";
          opacity: 0.3;
          font-style: italic;
          pointer-events: none;
        }
        
        [data-inline-type="media"]:empty {
          min-height: 100px;
          min-width: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.05);
          border: 1px dashed rgba(0,0,0,0.2);
          border-radius: 8px;
        }

        [data-inline-type="richtext"]:empty {
          min-height: 80px;
          border: 1px dashed rgba(0,0,0,0.2);
          padding: 1rem;
          border-radius: 8px;
        }

        .dark [data-inline-type="media"]:empty {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.2);
        }
      `}</style>
      {mediaTarget && (
        <MediaPickerModal
          open
          onOpenChange={(open) => {
            if (!open) setMediaTarget(null)
          }}
          onSelect={(item) => {
            setValue(mediaTarget.moduleId, mediaTarget.path, item)
            setMediaTarget(null)
          }}
          allowUpload
          title="Select media"
        />
      )}
      <Dialog
        open={enabled && !!dialogState}
        onOpenChange={(open) => !open && setDialogState(null)}
      >
        <DialogContent
          className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none"
          aria-describedby={undefined}
        >
          {dialogState && (
            <div className="bg-backdrop-low rounded-2xl border border-line-low shadow-2xl overflow-hidden flex flex-col">
              <DialogHeader className="px-6 py-4 border-b border-line-low bg-backdrop-low">
                <DialogTitle className="text-base font-bold text-neutral-high">
                  {dialogState.label || formatPathLabel(dialogState.path)}
                </DialogTitle>
              </DialogHeader>
              <div className="p-6 overflow-auto">
                <FieldDialogContent
                  pop={dialogState}
                  onClose={() => setDialogState(null)}
                  getValue={getValue}
                  setValue={setValue}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>,
    document.body
  )
}

type DialogContentProps = {
  pop: {
    moduleId: string
    path: string
    type: string
    label?: string
    postType?: string
    options?: Array<{ label: string; value: any }>
    multi?: boolean
    fields?: ObjectField[]
  }
  onClose: () => void
  getValue: (moduleId: string, path: string, fallback: any) => any
  setValue: (moduleId: string, path: string, value: any) => void
}

// Helper to format camelCase path to Title Case with spaces
function formatPathLabel(path: string): string {
  // Get last segment of path (e.g., "primaryCta" from "module.primaryCta")
  const lastPart = path.split('.').pop() || path
  // Insert space before capital letters and capitalize first letter
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

function FieldDialogContent({ pop, onClose, getValue, setValue }: DialogContentProps) {
  const { moduleId, path, type, options, multi, fields } = pop
  const currentValFromCtx = getValue(moduleId, path, null)

  const [draft, setDraft] = useState<any>(() => {
    if (multi && Array.isArray(currentValFromCtx)) return currentValFromCtx
    if (type === 'object' && (!currentValFromCtx || typeof currentValFromCtx !== 'object'))
      return {}
    return currentValFromCtx
  })

  // Keep local draft in sync with context (essential for first-edit reactivity and external updates)
  useEffect(() => {
    const isObject = type === 'object'
    const normalizedCtx =
      isObject && (!currentValFromCtx || typeof currentValFromCtx !== 'object')
        ? {}
        : currentValFromCtx
    if (JSON.stringify(normalizedCtx) !== JSON.stringify(draft)) {
      setDraft(normalizedCtx)
    }
  }, [currentValFromCtx, type])

  const labelStyle =
    'block text-[11px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1'
  const inputStyle =
    'w-full border border-line-medium rounded-xl px-4 py-2.5 bg-backdrop-low text-neutral-high text-sm focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all shadow-sm'
  const selectStyle =
    'w-full border border-line-medium rounded-xl px-4 py-2.5 bg-backdrop-low text-neutral-high text-sm focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all shadow-sm appearance-none'
  const buttonStyle =
    'w-full mt-6 bg-standout-medium text-on-standout px-4 py-3 rounded-xl font-bold shadow-lg shadow-standout-medium/20 hover:bg-standout-high transition-all flex items-center justify-center gap-2'
  const containerStyle = 'p-4 bg-backdrop-medium/30 border border-line-low rounded-xl space-y-4'

  const renderControl = () => {
    switch (type) {
      case 'richtext': {
        return (
          <div className="space-y-4">
            <div className="border border-line-medium rounded-xl bg-backdrop-low overflow-hidden shadow-sm">
              <LexicalEditor
                value={draft ?? ''}
                onChange={(val) => {
                  setDraft(val)
                  setValue(moduleId, path, val)
                }}
                placeholder="Start typing…"
                editorKey={`${moduleId}-${path}-richtext`}
              />
            </div>
          </div>
        )
      }
      case 'post-reference': {
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <EditablePostReference
                moduleId={moduleId}
                path={path}
                multiple={multi}
                postType={pop.postType}
                label={pop.label || 'Select posts'}
              />
            </div>
          </div>
        )
      }
      case 'link': {
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <LinkField
                label="Destination"
                value={draft}
                onChange={(val: LinkFieldValue) => {
                  setDraft(val)
                  setValue(moduleId, path, val)
                }}
              />
            </div>
          </div>
        )
      }
      case 'select':
      case 'icon': {
        const opts = type === 'icon' ? iconOptions : options || []
        if (type === 'icon') {
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-auto p-1">
                {opts.map((o: any) => {
                  const val = o.name ?? o.value
                  const icon = o.icon ?? val
                  return (
                    <Tooltip key={val}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={`p-3 border rounded-xl hover:bg-backdrop-medium flex flex-col items-center gap-2 transition-all ${
                            draft === val
                              ? 'border-standout-medium bg-standout-medium/10 shadow-sm ring-1 ring-standout-medium/20'
                              : 'border-line-low bg-backdrop-low/50'
                          }`}
                          onClick={() => {
                            setDraft(val)
                            setValue(moduleId, path, val)
                          }}
                        >
                          <FontAwesomeIcon icon={icon as any} className="w-6 h-6" />
                          <span className="text-[10px] font-medium text-neutral-medium truncate w-full text-center">
                            {o.label}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{o.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )
        }
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <label className={labelStyle}>Select Option</label>
              <div className="relative">
                <select
                  className={selectStyle}
                  value={draft ?? ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setDraft(val)
                    setValue(moduleId, path, val)
                  }}
                >
                  <option value="">-- Select --</option>
                  {opts.map((o: any) => {
                    const val = o.value ?? o.name
                    return (
                      <option key={val} value={val}>
                        {o.label}
                      </option>
                    )
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-low">
                  <FontAwesomeIcon icon={faChevronDown} className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )
      }
      case 'textarea': {
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <label className={labelStyle}>Content</label>
              <textarea
                className={`${inputStyle} min-h-[160px] resize-vertical`}
                value={draft ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setDraft(val)
                  setValue(moduleId, path, val)
                }}
                placeholder="Start typing..."
              />
            </div>
          </div>
        )
      }
      case 'repeater-text': {
        const asArray: string[] = Array.isArray(draft)
          ? draft
          : typeof draft === 'string'
            ? draft.split('\n').filter(Boolean)
            : []
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <label className={labelStyle}>List Items (one per line)</label>
              <textarea
                className={`${inputStyle} min-h-[180px] resize-vertical font-mono text-xs`}
                value={asArray.join('\n')}
                onChange={(e) => {
                  const val = e.target.value.split('\n')
                  setDraft(val)
                  setValue(moduleId, path, val)
                }}
                placeholder="Item 1&#10;Item 2..."
              />
            </div>
          </div>
        )
      }
      case 'multiselect': {
        const opts = options || []
        const current: any[] = Array.isArray(draft) ? draft : []
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <label className={labelStyle}>Select Multiple</label>
              <div className="space-y-2 max-h-64 overflow-auto p-1">
                {opts.map((o) => {
                  const checked = current.includes(o.value)
                  return (
                    <label
                      key={o.value}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        checked
                          ? 'bg-standout-medium/10 border-standout-medium/30 text-neutral-high'
                          : 'bg-backdrop-low border-line-medium text-neutral-medium hover:border-neutral-low'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-line-high text-standout-medium focus:ring-standout-medium/20"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? current.filter((v) => v !== o.value)
                            : [...current, o.value]
                          setDraft(next)
                          setValue(moduleId, path, next)
                        }}
                      />
                      <span className="text-sm font-medium">{o.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )
      }
      case 'number':
      case 'slider': {
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <label className={labelStyle}>Value</label>
              <input
                type="number"
                className={inputStyle}
                value={draft ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value)
                  setDraft(val)
                  setValue(moduleId, path, val)
                }}
              />
            </div>
          </div>
        )
      }
      case 'boolean': {
        const checked = !!draft
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <label className="flex items-center gap-3 p-4 rounded-xl border border-line-medium bg-backdrop-low cursor-pointer hover:border-neutral-low transition-all">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-line-high text-standout-medium focus:ring-standout-medium/20"
                  checked={checked}
                  onChange={(e) => {
                    const val = e.target.checked
                    setDraft(val)
                    setValue(moduleId, path, val)
                  }}
                />
                <span className="text-sm font-semibold text-neutral-high uppercase tracking-wider">
                  Enabled
                </span>
              </label>
            </div>
          </div>
        )
      }
      case 'date': {
        return (
          <div className="space-y-4">
            <div className={containerStyle}>
              <label className={labelStyle}>Date</label>
              <input
                type="date"
                className={inputStyle}
                value={draft ?? ''}
                onChange={(e) => {
                  const val = e.target.value || null
                  setDraft(val)
                  setValue(moduleId, path, val)
                }}
              />
            </div>
          </div>
        )
      }
      case 'object': {
        if (!fields || fields.length === 0) {
          return (
            <div className="p-8 text-center bg-backdrop-medium/20 rounded-xl border border-dashed border-line-medium">
              <FontAwesomeIcon icon={faCircleQuestion} className="text-3xl text-neutral-low mb-2" />
              <p className="text-sm text-neutral-medium">No fields defined for this object</p>
            </div>
          )
        }
        const obj = draft && typeof draft === 'object' ? draft : {}
        const updateField = (fieldName: string, value: any) => {
          const next = { ...(draft || {}), [fieldName]: value }
          setDraft(next)
          setValue(moduleId, path, next)
        }
        return (
          <div className="space-y-6">
            <div className={containerStyle}>
              {fields.map((field) => {
                const fieldValue = obj[field.name]
                switch (field.type) {
                  case 'text':
                  case 'textarea':
                    return (
                      <div key={field.name} className="space-y-1.5">
                        <label className={labelStyle}>{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            className={`${inputStyle} min-h-[100px] resize-none`}
                            rows={3}
                            value={fieldValue ?? ''}
                            onChange={(e) => updateField(field.name, e.target.value)}
                          />
                        ) : (
                          <input
                            type="text"
                            className={inputStyle}
                            value={fieldValue ?? ''}
                            onChange={(e) => updateField(field.name, e.target.value)}
                          />
                        )}
                      </div>
                    )
                  case 'link':
                    return (
                      <div
                        key={field.name}
                        className="space-y-1.5 pt-2 border-t border-line-low/50"
                      >
                        <LinkField
                          label={field.label}
                          value={fieldValue}
                          onChange={(val) => updateField(field.name, val)}
                        />
                      </div>
                    )
                  case 'richtext':
                    return (
                      <div
                        key={field.name}
                        className="space-y-1.5 pt-2 border-t border-line-low/50"
                      >
                        <label className={labelStyle}>{field.label}</label>
                        <div className="border border-line-medium rounded-xl bg-backdrop-low p-2 shadow-sm">
                          <LexicalEditor
                            value={fieldValue ?? ''}
                            onChange={(val) => updateField(field.name, val)}
                            placeholder="Start typing…"
                            editorKey={`${moduleId}-${path}-${field.name}`}
                          />
                        </div>
                      </div>
                    )
                  case 'select':
                    return (
                      <div
                        key={field.name}
                        className="space-y-1.5 pt-2 border-t border-line-low/50"
                      >
                        <label className={labelStyle}>{field.label}</label>
                        <div className="relative">
                          <select
                            className={selectStyle}
                            value={fieldValue ?? ''}
                            onChange={(e) => updateField(field.name, e.target.value)}
                          >
                            <option value="">-- Select --</option>
                            {(field.options || []).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-low">
                            <FontAwesomeIcon icon={faChevronDown} className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    )
                  case 'repeater-text': {
                    const arr: string[] = Array.isArray(fieldValue)
                      ? fieldValue
                      : typeof fieldValue === 'string'
                        ? fieldValue.split('\n').filter(Boolean)
                        : []
                    const updateItem = (i: number, val: string) => {
                      const next = [...arr]
                      next[i] = val
                      updateField(field.name, next)
                    }
                    const removeItem = (i: number) => {
                      const next = arr.filter((_, idx) => idx !== i)
                      updateField(field.name, next)
                    }
                    const moveItem = (i: number, dir: -1 | 1) => {
                      const j = i + dir
                      if (j < 0 || j >= arr.length) return
                      const next = [...arr]
                      const tmp = next[i]
                      next[i] = next[j]
                      next[j] = tmp
                      updateField(field.name, next)
                    }
                    const addItem = () => {
                      updateField(field.name, [...arr, ''])
                    }
                    return (
                      <div key={field.name} className="space-y-3 pt-2 border-t border-line-low/50">
                        <label className={labelStyle}>{field.label}</label>
                        <div className="space-y-2">
                          {arr.map((val, i) => (
                            <div key={i} className="flex items-center gap-2 group/item">
                              <input
                                type="text"
                                className="flex-1 border border-line-medium rounded-xl px-3 py-2 bg-backdrop-low text-neutral-high text-sm focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all shadow-sm"
                                value={val}
                                onChange={(e) => updateItem(i, e.target.value)}
                              />
                              <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="w-8 h-8 flex items-center justify-center border border-line-medium rounded-lg bg-backdrop-low hover:bg-backdrop-medium text-neutral-medium hover:text-neutral-high transition-colors shadow-sm"
                                      onClick={() => moveItem(i, -1)}
                                      aria-label="Move up"
                                    >
                                      <FontAwesomeIcon icon={faArrowUp} className="w-4 h-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Move up</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="w-8 h-8 flex items-center justify-center border border-line-medium rounded-lg bg-backdrop-low hover:bg-backdrop-medium text-neutral-medium hover:text-neutral-high transition-colors shadow-sm"
                                      onClick={() => moveItem(i, 1)}
                                      aria-label="Move down"
                                    >
                                      <FontAwesomeIcon icon={faArrowDown} className="w-4 h-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Move down</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="w-8 h-8 flex items-center justify-center border border-line-medium rounded-lg bg-backdrop-low hover:bg-red-500/10 text-neutral-low hover:text-red-500 transition-colors shadow-sm"
                                      onClick={() => removeItem(i)}
                                      aria-label="Remove"
                                    >
                                      <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Remove</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="w-full py-2.5 text-xs font-bold rounded-xl border border-dashed border-line-high text-neutral-medium hover:border-neutral-low hover:bg-backdrop-medium transition-all flex items-center justify-center gap-2 mt-2"
                            onClick={addItem}
                          >
                            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                            Add {field.label} Item
                          </button>
                        </div>
                      </div>
                    )
                  }
                  case 'number':
                    return (
                      <div
                        key={field.name}
                        className="space-y-1.5 pt-2 border-t border-line-low/50"
                      >
                        <label className={labelStyle}>{field.label}</label>
                        <input
                          type="number"
                          className={inputStyle}
                          value={fieldValue ?? ''}
                          onChange={(e) =>
                            updateField(
                              field.name,
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                        />
                      </div>
                    )
                  case 'boolean':
                    return (
                      <div
                        key={field.name}
                        className="space-y-1.5 pt-2 border-t border-line-low/50"
                      >
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-line-medium bg-backdrop-low cursor-pointer hover:border-neutral-low transition-all">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-line-high text-standout-medium focus:ring-standout-medium/20"
                            checked={!!fieldValue}
                            onChange={(e) => updateField(field.name, e.target.checked)}
                          />
                          <span className="text-xs font-bold text-neutral-high uppercase tracking-wider">
                            {field.label}
                          </span>
                        </label>
                      </div>
                    )
                  default:
                    return (
                      <div
                        key={field.name}
                        className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-[10px] text-red-500 font-mono"
                      >
                        Unsupported field type: {field.type}
                      </div>
                    )
                }
              })}
            </div>
          </div>
        )
      }
      default:
        return (
          <div className="space-y-4">
            <div className="p-8 text-center bg-backdrop-medium/20 rounded-xl border border-dashed border-line-medium">
              <FontAwesomeIcon
                icon={faCircleExclamation}
                className="text-3xl text-neutral-low mb-2"
              />
              <p className="text-sm text-neutral-medium uppercase font-bold tracking-wider">
                Unsupported Inline Type
              </p>
              <p className="text-xs text-neutral-low mt-1">{type}</p>
            </div>
            <button
              className={`${buttonStyle} bg-backdrop-medium text-neutral-high border border-line-medium shadow-none hover:bg-backdrop-high`}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )
    }
  }

  return <div>{renderControl()}</div>
}
