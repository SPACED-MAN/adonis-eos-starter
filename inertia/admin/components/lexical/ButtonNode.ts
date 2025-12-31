import {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementNode,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from 'lexical'

export type ButtonVariant = 'primary' | 'secondary' | 'outline'

export type SerializedButtonNode = Spread<
  {
    url: string
    variant: ButtonVariant
    target?: string
  },
  SerializedElementNode
>

export class ButtonNode extends ElementNode {
  __url: string
  __variant: ButtonVariant
  __target?: string

  static getType(): string {
    return 'lexical-button'
  }

  static clone(node: ButtonNode): ButtonNode {
    return new ButtonNode(node.__url, node.__variant, node.__target, node.__key)
  }

  constructor(url: string, variant: ButtonVariant = 'primary', target?: string, key?: NodeKey) {
    super(key)
    this.__url = url
    this.__variant = variant
    this.__target = target
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('a')
    element.href = this.__url
    if (this.__target) {
      element.target = this.__target
    }
    element.className = this.getClasses()
    return element
  }

  updateDOM(prevNode: ButtonNode, anchor: HTMLElement, config: EditorConfig): boolean {
    const url = this.__url
    const variant = this.__variant
    const target = this.__target

    if (url !== prevNode.__url) {
      anchor.setAttribute('href', url)
    }
    if (target !== prevNode.__target) {
      if (target) {
        anchor.setAttribute('target', target)
      } else {
        anchor.removeAttribute('target')
      }
    }
    if (variant !== prevNode.__variant) {
      anchor.className = this.getClasses()
    }
    return false
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (domNode: Node) => {
        if (domNode instanceof HTMLAnchorElement) {
          if (domNode.classList.contains('inline-flex') || domNode.classList.contains('lexical-button')) {
            return {
              conversion: convertButtonElement,
              priority: 2,
            }
          }
        }
        return null
      },
    }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('a')
    element.setAttribute('href', this.__url)
    if (this.__target) {
      element.setAttribute('target', this.__target)
    }
    element.className = this.getClasses()
    return { element }
  }

  getClasses(): string {
    const base = 'inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-colors duration-200 !no-underline !not-prose'
    const variants = {
      primary: '!bg-standout-high !text-on-high hover:opacity-90',
      secondary: '!bg-backdrop-medium hover:bg-backdrop-high !text-neutral-high',
      outline: 'border border-line-low hover:bg-backdrop-medium !text-neutral-high',
    }
    return `${base} ${variants[this.__variant] || variants.primary} mb-2 mr-2 cursor-pointer lexical-button`
  }

  static importJSON(serializedNode: SerializedButtonNode): ButtonNode {
    const node = $createButtonNode(serializedNode.url, serializedNode.variant, serializedNode.target)
    return node
  }

  exportJSON(): SerializedButtonNode {
    return {
      ...super.exportJSON(),
      type: 'lexical-button',
      url: this.__url,
      variant: this.__variant,
      target: this.__target,
      version: 1,
    }
  }

  getURL(): string {
    return this.__url
  }

  setURL(url: string): void {
    const writable = this.getWritable()
    writable.__url = url
  }

  getVariant(): ButtonVariant {
    return this.__variant
  }

  setVariant(variant: ButtonVariant): void {
    const writable = this.getWritable()
    writable.__variant = variant
  }

  getTarget(): string | undefined {
    return this.__target
  }

  setTarget(target: string | undefined): void {
    const writable = this.getWritable()
    writable.__target = target
  }

  isInline(): boolean {
    return true
  }

  canBeEmpty(): false {
    return false
  }
}

function convertButtonElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLAnchorElement) {
    const url = domNode.getAttribute('href') || ''
    const target = domNode.getAttribute('target') || undefined
    let variant: ButtonVariant = 'primary'
    if (domNode.classList.contains('bg-backdrop-medium')) variant = 'secondary'
    else if (domNode.classList.contains('border')) variant = 'outline'
    
    const node = $createButtonNode(url, variant, target)
    return { node }
  }
  return null
}

export function $createButtonNode(url: string, variant: ButtonVariant = 'primary', target?: string): ButtonNode {
  return new ButtonNode(url, variant, target)
}

export function $isButtonNode(node: LexicalNode | null | undefined): node is ButtonNode {
  return node instanceof ButtonNode
}
