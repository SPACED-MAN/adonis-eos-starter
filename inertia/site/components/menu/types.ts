export type MenuItem = {
  id: string
  parentId: string | null
  label: string
  type: 'post' | 'custom' | 'dynamic'
  postId?: string | null
  customUrl?: string | null
  url?: string | null
  anchor?: string | null
  target?: string | null
  rel?: string | null
  kind?: 'item' | 'section'
  dynamicPostType?: string | null
  dynamicParentId?: string | null
  dynamicDepthLimit?: number | null
}

export type TreeNode = MenuItem & { children: TreeNode[] }
