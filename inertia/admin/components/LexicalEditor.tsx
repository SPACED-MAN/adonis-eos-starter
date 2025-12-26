import { useEffect, useMemo, useRef } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { CodeNode } from '@lexical/code'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createHeadingNode } from '@lexical/rich-text'
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from '@lexical/list'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBold,
  faItalic,
  faUnderline,
  faListUl,
  faListOl,
  faParagraph,
  faHeading,
  faCode,
  faMinus,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons'
import { $createCodeNode } from '@lexical/code'
import { $insertNodes, $createTextNode } from 'lexical'
import { TokenPicker } from './ui/TokenPicker'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { IconProp } from '@fortawesome/fontawesome-svg-core'

function InitialContentPlugin({ initialValue, editorKey }: { initialValue: any; editorKey?: string }) {
  const [editor] = useLexicalComposerContext()
  
  // Use a ref to track if we've already initialized for this specific editorKey
  // to avoid infinite loops if initialValue is not stable.
  const initializedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    // Only run if the key has changed or we haven't initialized yet
    if (initializedKeyRef.current === editorKey && editorKey !== undefined) return
    initializedKeyRef.current = editorKey || 'default'

    try {
      let candidate: any = initialValue
      if (!candidate) return

      if (typeof candidate === 'string') {
        const trimmed = candidate.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            candidate = JSON.parse(trimmed)
          } catch {
            // Not JSON, treat as plain text below
          }
        }

        // If it's still a string, wrap it in a paragraph
        if (typeof candidate === 'string') {
          candidate = {
            root: {
              type: 'root',
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'paragraph',
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                  children: [
                    {
                      type: 'text',
                      text: candidate,
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      version: 1,
                    },
                  ],
                },
              ],
            },
          }
        }
      }

      if (typeof candidate !== 'object') return
      if (!candidate.root || !Array.isArray(candidate.root.children)) return

      // normalize nodes to include minimal required fields for Lexical
      const normalizeNode = (node: any): any => {
        if (!node || typeof node !== 'object' || typeof node.type !== 'string') return null
        const t = node.type
        if (t === 'root') {
          const children = Array.isArray(node.children)
            ? node.children.map(normalizeNode).filter(Boolean)
            : []
          return {
            type: 'root',
            direction: node.direction ?? 'ltr',
            format: node.format ?? '',
            indent: node.indent ?? 0,
            version: node.version ?? 1,
            children,
          }
        }
        if (t === 'paragraph') {
          const children = Array.isArray(node.children)
            ? node.children.map(normalizeNode).filter(Boolean)
            : []
          return {
            type: 'paragraph',
            direction: node.direction ?? 'ltr',
            format: node.format ?? '',
            indent: node.indent ?? 0,
            version: node.version ?? 1,
            children,
          }
        }
        if (t === 'text') {
          return {
            type: 'text',
            text: typeof node.text === 'string' ? node.text : '',
            detail: node.detail ?? 0,
            format: node.format ?? 0,
            mode: node.mode ?? 'normal',
            style: node.style ?? '',
            version: node.version ?? 1,
          }
        }
        // pass through other known nodes with defaults
        const pass = {
          ...node,
          version: node.version ?? 1,
        }
        if (Array.isArray(node.children)) {
          pass.children = node.children.map(normalizeNode).filter(Boolean)
        }
        return pass
      }
      const normalizedRoot = normalizeNode(candidate.root)
      if (!normalizedRoot) return
      const normalized = { ...candidate, root: normalizedRoot }
      const parsed = editor.parseEditorState(JSON.stringify(normalized))
      editor.setEditorState(parsed)
    } catch {
      // ignore invalid initial state
    }
  }, [editor, initialValue, editorKey])
  return null
}

export function LexicalEditor({
  value,
  onChange,
  placeholder = 'Start typing…',
  editorKey,
  customFields,
}: {
  value: any
  onChange: (json: any) => void
  placeholder?: string
  editorKey?: string
  customFields?: Array<{ slug: string; label: string }>
}) {
  const theme = useMemo(
    () => ({
      paragraph: 'mb-2',
      quote: 'border-l-4 border-line-low pl-3 italic text-neutral-medium',
      heading: {
        h1: 'text-2xl font-semibold mb-2',
        h2: 'text-xl font-semibold mb-2',
        h3: 'text-lg font-semibold mb-2',
      },
      list: {
        ul: 'list-disc pl-5',
        ol: 'list-decimal pl-5',
        listitem: 'mb-1',
      },
      text: {
        bold: 'font-semibold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'font-mono bg-backdrop-medium px-1 rounded',
      },
      link: 'text-standout-high underline',
    }),
    []
  )

  function onError() {
    // Error in Lexical editor
  }

  const initialConfig = useMemo(
    () => ({
      namespace: `prose-editor${editorKey ? `-${editorKey}` : ''}`,
      theme,
      onError,
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        LinkNode,
        AutoLinkNode,
        CodeNode,
        HorizontalRuleNode,
      ],
    }),
    [theme, editorKey]
  )

  return (
    <LexicalComposer key={editorKey} initialConfig={initialConfig}>
      <div className="border border-border rounded bg-backdrop-low">
        <Toolbar customFields={customFields} />
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[160px] p-3 outline-none text-neutral-high" />
          }
          placeholder={<div className="p-3 text-neutral-low">{placeholder}</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <InitialContentPlugin initialValue={value} editorKey={editorKey} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <OnChangePlugin
          onChange={(state) => {
            try {
              const json = state.toJSON()
              onChange(json)
            } catch {
              // ignore
            }
          }}
        />
      </div>
    </LexicalComposer>
  )
}

function ToolbarButton({
  title,
  onClick,
  icon,
  children,
  className,
}: {
  title: string
  onClick: () => void
  icon?: IconProp
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low ${className || ''}`}
          onClick={onClick}
        >
          {icon && <FontAwesomeIcon icon={icon} className={children ? 'mr-1' : ''} />}
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function Toolbar({ customFields }: { customFields?: Array<{ slug: string; label: string }> }) {
  const [editor] = useLexicalComposerContext()

  const handleTokenSelect = (tokenName: string) => {
    editor.update(() => {
      const selection = $getSelection()
      const tokenText = `{${tokenName}}`

      if (selection) {
        // Insert token at cursor position, replacing any selected text
        selection.insertText(tokenText)
      } else {
        // If no selection, insert text node directly
        // This handles the edge case where editor is empty or has no focus
        const textNode = $createTextNode(tokenText)
        $insertNodes([textNode])
      }
    })
  }

  const setBlock = (type: 'paragraph' | 'h2' | 'h3' | 'code') => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (type === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode())
        } else if (type === 'h2' || type === 'h3') {
          $setBlocksType(selection, () => $createHeadingNode(type))
        } else if (type === 'code') {
          $setBlocksType(selection, () => $createCodeNode())
        }
      }
    })
  }

  return (
    <div className="flex items-center gap-1 border-b border-line-low bg-backdrop-medium px-2 py-1">
      <ToolbarButton
        title="Bold"
        icon={faBold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      />
      <ToolbarButton
        title="Italic"
        icon={faItalic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      />
      <ToolbarButton
        title="Underline"
        icon={faUnderline}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      />
      <ToolbarButton
        title="Inline Code"
        icon={faCode}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
      />
      <div className="mx-2 h-4 w-px bg-line" />
      <ToolbarButton title="Paragraph" icon={faParagraph} onClick={() => setBlock('paragraph')} />
      <ToolbarButton title="Heading 2" icon={faHeading} onClick={() => setBlock('h2')}>
        H2
      </ToolbarButton>
      <ToolbarButton title="Heading 3" icon={faHeading} onClick={() => setBlock('h3')}>
        H3
      </ToolbarButton>
      <div className="mx-2 h-4 w-px bg-line" />
      <ToolbarButton
        title="Bullet List"
        icon={faListUl}
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      />
      <ToolbarButton
        title="Numbered List"
        icon={faListOl}
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
      />
      <div className="mx-2 h-4 w-px bg-line" />
      <ToolbarButton title="Code Block" icon={faTerminal} onClick={() => setBlock('code')} />
      <ToolbarButton
        title="Horizontal Rule"
        icon={faMinus}
        onClick={() =>
          editor.update(() => {
            const hrNode = new HorizontalRuleNode()
            $insertNodes([hrNode])
          })
        }
      />
      <div className="mx-2 h-4 w-px bg-line" />
      <TokenPicker onSelect={handleTokenSelect} customFields={customFields} />
    </div>
  )
}
