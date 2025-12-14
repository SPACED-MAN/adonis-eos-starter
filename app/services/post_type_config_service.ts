import type { PostTypeField } from '../types/custom_field.ts'

type PostTypeUiConfig = {
  hideCoreFields?: Array<'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'>
  hierarchyEnabled?: boolean
  fields?: PostTypeField[]
  moduleGroup?: { name: string; description?: string } | null
  urlPatterns?: Array<{ locale: string; pattern: string; isDefault?: boolean }>
  permalinksEnabled?: boolean
  /**
   * Whether modules should be available for this post type.
   * Defaults to true when permalinks are enabled AND urlPatterns exist.
   */
  modulesEnabled?: boolean
  /**
   * Whether module groups should be available for this post type.
   * Defaults to true when permalinks are enabled AND urlPatterns exist.
   */
  moduleGroupsEnabled?: boolean
  taxonomies?: string[]
  featuredImage?: {
    enabled: boolean
    label?: string
  }
}

import postTypeRegistry from '#services/post_type_registry'

const registry: Record<string, PostTypeUiConfig> = {}
const cache = new Map<string, Required<PostTypeUiConfig>>()

class PostTypeConfigService {
  getUiConfig(postType: string): Required<PostTypeUiConfig> {
    const base: Required<PostTypeUiConfig> = {
      hideCoreFields: [],
      hierarchyEnabled: true,
      fields: [],
      moduleGroup: { name: `${postType}-default` },
      urlPatterns: [],
      permalinksEnabled: true,
      modulesEnabled: true,
      moduleGroupsEnabled: true,
      taxonomies: [],
      featuredImage: { enabled: false, label: 'Featured Image' },
    }
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev && cache.has(postType)) return cache.get(postType)!
    // Prefer registry (explicit registration in start/post_types.ts)
    let cfg: PostTypeUiConfig = (postTypeRegistry.get(postType) as any) || registry[postType] || {}
    // Source of truth is registry or app/post_types files
    // Try to load from app/post_types/<postType>.(ts|js)
    try {
      const path = require('node:path')
      const { pathToFileURL } = require('node:url')
      const fs = require('node:fs')
      const appRoot = process.cwd()
      const candidates = [
        path.join(appRoot, 'app', 'post_types', `${postType}.ts`),
        path.join(appRoot, 'app', 'post_types', `${postType}.js`),
      ]
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const mod = require(pathToFileURL(p).href)
          const loaded = (mod?.default || mod) as PostTypeUiConfig
          if (loaded && typeof loaded === 'object') {
            cfg = { ...cfg, ...loaded }
            break
          }
        }
      }
    } catch {
      /* ignore dynamic import errors */
    }
    const urlPatterns = Array.isArray(cfg.urlPatterns) ? cfg.urlPatterns : []
    const permalinksEnabled =
      cfg.permalinksEnabled !== undefined ? !!cfg.permalinksEnabled : base.permalinksEnabled
    const hasPermalinks = permalinksEnabled && urlPatterns.length > 0
    const modulesEnabled =
      cfg.modulesEnabled !== undefined ? !!cfg.modulesEnabled : hasPermalinks
    const moduleGroupsEnabled =
      cfg.moduleGroupsEnabled !== undefined ? !!cfg.moduleGroupsEnabled : hasPermalinks

    const full: Required<PostTypeUiConfig> = {
      hideCoreFields: Array.isArray(cfg.hideCoreFields) ? (cfg.hideCoreFields as any) : [],
      hierarchyEnabled:
        cfg.hierarchyEnabled !== undefined ? !!cfg.hierarchyEnabled : base.hierarchyEnabled,
      fields: Array.isArray(cfg.fields) ? cfg.fields : [],
      moduleGroup:
        moduleGroupsEnabled && cfg.moduleGroup && cfg.moduleGroup.name
          ? cfg.moduleGroup
          : moduleGroupsEnabled
            ? base.moduleGroup
            : null,
      urlPatterns,
      permalinksEnabled,
      modulesEnabled,
      moduleGroupsEnabled,
      taxonomies: Array.isArray(cfg.taxonomies) ? cfg.taxonomies : [],
      featuredImage:
        cfg.featuredImage && cfg.featuredImage.enabled
          ? { enabled: true, label: cfg.featuredImage.label || 'Featured Image' }
          : { enabled: false, label: 'Featured Image' },
    }
    if (!isDev) cache.set(postType, full)
    return full
  }
}

const postTypeConfigService = new PostTypeConfigService()
export default postTypeConfigService
