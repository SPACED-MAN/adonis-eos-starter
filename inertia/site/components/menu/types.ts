export type MenuItem = {
  id: string
  parentId: string | null
  label: string
  type: 'post' | 'custom'
  postId?: string | null
  customUrl?: string | null
  anchor?: string | null
  target?: string | null
  rel?: string | null
  kind?: 'item' | 'section'
}

export type TreeNode = MenuItem & { children: TreeNode[] }
