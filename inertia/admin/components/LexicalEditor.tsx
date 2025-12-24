import { useEffect, useMemo } from 'react'
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

function InitialContentPlugin({ initialValue }: { initialValue: any }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
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
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
        <InitialContentPlugin initialValue={value} />
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
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Bold"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      >
        <FontAwesomeIcon icon={faBold} />
      </button>
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Italic"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      >
        <FontAwesomeIcon icon={faItalic} />
      </button>
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Underline"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      >
        <FontAwesomeIcon icon={faUnderline} />
      </button>
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Inline Code"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
      >
        <FontAwesomeIcon icon={faCode} />
      </button>
      <div className="mx-2 h-4 w-px bg-line" />
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Paragraph"
        onClick={() => setBlock('paragraph')}
      >
        <FontAwesomeIcon icon={faParagraph} />
      </button>
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Heading 2"
        onClick={() => setBlock('h2')}
      >
        <FontAwesomeIcon icon={faHeading} className="mr-1" />
        H2
      </button>
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Heading 3"
        onClick={() => setBlock('h3')}
      >
        <FontAwesomeIcon icon={faHeading} className="mr-1" />
        H3
      </button>
      <div className="mx-2 h-4 w-px bg-line" />
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        title="Bullet List"
      >
        <FontAwesomeIcon icon={faListUl} />
      </button>
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        title="Numbered List"
      >
        <FontAwesomeIcon icon={faListOl} />
      </button>
      <div className="mx-2 h-4 w-px bg-line" />
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Code Block"
        onClick={() => setBlock('code')}
      >
        <FontAwesomeIcon icon={faTerminal} />
      </button>
      <button
        type="button"
        className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-low"
        title="Horizontal Rule"
        onClick={() =>
          editor.update(() => {
            const hrNode = new HorizontalRuleNode()
            $insertNodes([hrNode])
          })
        }
      >
        <FontAwesomeIcon icon={faMinus} />
      </button>
      <div className="mx-2 h-4 w-px bg-line" />
      <TokenPicker onSelect={handleTokenSelect} customFields={customFields} />
    </div>
  )
}
