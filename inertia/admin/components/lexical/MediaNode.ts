import {
  EditorConfig,
  ElementNode,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from 'lexical'

export type SerializedMediaNode = Spread<
  {
    url: string
    alt?: string
    mimeType?: string
    id?: string
  },
  SerializedElementNode
>

export class MediaNode extends ElementNode {
  __url: string
  __alt?: string
  __mimeType?: string
  __id?: string

  static getType(): string {
    return 'lexical-media'
  }

  static clone(node: MediaNode): MediaNode {
    return new MediaNode(node.__url, node.__alt, node.__mimeType, node.__id, node.__key)
  }

  constructor(
    url: string,
    alt?: string,
    mimeType?: string,
    id?: string,
    key?: NodeKey
  ) {
    super(key)
    this.__url = url
    this.__alt = alt
    this.__mimeType = mimeType
    this.__id = id
  }

  createDOM(config: EditorConfig): HTMLElement {
    const isVideo = this.__mimeType?.startsWith('video/') || this.__url.toLowerCase().endsWith('.mp4')
    
    const div = document.createElement('div')
    div.className = 'my-4 rounded-lg overflow-hidden border border-line-low bg-backdrop-medium max-w-2xl mx-auto'
    
    if (isVideo) {
      const video = document.createElement('video')
      video.src = this.__url
      video.className = 'w-full h-auto block'
      video.controls = true
      div.appendChild(video)
    } else {
      const img = document.createElement('img')
      img.src = this.__url
      img.alt = this.__alt || ''
      img.className = 'w-full h-auto block'
      div.appendChild(img)
    }

    if (this.__alt) {
      const caption = document.createElement('div')
      caption.className = 'px-3 py-2 text-xs text-neutral-medium border-t border-line-low italic'
      caption.textContent = this.__alt
      div.appendChild(caption)
    }

    return div
  }

  updateDOM(prevNode: MediaNode, dom: HTMLElement, config: EditorConfig): boolean {
    if (
      prevNode.__url !== this.__url ||
      prevNode.__mimeType !== this.__mimeType ||
      prevNode.__alt !== this.__alt
    ) {
      return true // Re-render if properties changed
    }
    return false
  }

  static importJSON(serializedNode: SerializedMediaNode): MediaNode {
    const node = $createMediaNode(
      serializedNode.url,
      serializedNode.alt,
      serializedNode.mimeType,
      serializedNode.id
    )
    return node
  }

  exportJSON(): SerializedMediaNode {
    return {
      ...super.exportJSON(),
      type: 'lexical-media',
      url: this.__url,
      alt: this.__alt,
      mimeType: this.__mimeType,
      id: this.__id,
      version: 1,
    }
  }

  isInline(): boolean {
    return false
  }
}

export function $createMediaNode(
  url: string,
  alt?: string,
  mimeType?: string,
  id?: string
): MediaNode {
  return new MediaNode(url, alt, mimeType, id)
}

export function $isMediaNode(node: LexicalNode | null | undefined): node is MediaNode {
  return node instanceof MediaNode
}

