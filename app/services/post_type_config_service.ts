import type { PostTypeConfig } from '../types/post_type.ts'

import postTypeRegistry from '#services/post_type_registry'

const registry: Record<string, PostTypeConfig> = {}
const cache = new Map<string, Required<PostTypeConfig>>()

class PostTypeConfigService {
  getUiConfig(postType: string): Required<PostTypeConfig> {
    const base: Required<PostTypeConfig> = {
      type: postType,
      label: '',
      pluralLabel: '',
      description: '',
      icon: '',
      hideCoreFields: [],
      hierarchyEnabled: true,
      fields: [],
      moduleGroup: { name: `${postType}-default`, description: '' },
      urlPatterns: [],
      permalinksEnabled: true,
      modulesEnabled: true,
      moduleGroupsEnabled: true,
      taxonomies: [],
      featuredImage: { enabled: false, label: 'Featured Image' },
      abTesting: { enabled: false, strategy: 'cookie', variations: [] },
      seoDefaults: { noindex: false, nofollow: false, robotsJson: null },
    }
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev && cache.has(postType)) return cache.get(postType)!
    // Prefer registry (explicit registration in start/post_types.ts)
    let cfg: PostTypeConfig = (postTypeRegistry.get(postType) as any) || registry[postType] || {}
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
          const loaded = (mod?.default || mod) as PostTypeConfig
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
    const modulesEnabled = cfg.modulesEnabled !== undefined ? !!cfg.modulesEnabled : hasPermalinks
    const moduleGroupsEnabled =
      cfg.moduleGroupsEnabled !== undefined ? !!cfg.moduleGroupsEnabled : hasPermalinks

    const full: Required<PostTypeConfig> = {
      type: cfg.type || base.type,
      label: cfg.label || base.label,
      pluralLabel: cfg.pluralLabel || base.pluralLabel,
      description: cfg.description || base.description,
      icon: cfg.icon || base.icon,
      hideCoreFields: Array.isArray(cfg.hideCoreFields) ? (cfg.hideCoreFields as any) : [],
      hierarchyEnabled:
        cfg.hierarchyEnabled !== undefined ? !!cfg.hierarchyEnabled : base.hierarchyEnabled,
      fields: Array.isArray(cfg.fields) ? cfg.fields : [],
      moduleGroup:
        moduleGroupsEnabled && cfg.moduleGroup && cfg.moduleGroup.name
          ? {
              name: cfg.moduleGroup.name,
              description: cfg.moduleGroup.description || '',
            }
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
      abTesting: cfg.abTesting
        ? {
            enabled: !!cfg.abTesting.enabled,
            strategy: cfg.abTesting.strategy || 'cookie',
            variations: Array.isArray(cfg.abTesting.variations) ? cfg.abTesting.variations : [],
          }
        : base.abTesting,
      seoDefaults: cfg.seoDefaults
        ? {
            noindex: cfg.seoDefaults.noindex ?? base.seoDefaults.noindex,
            nofollow: cfg.seoDefaults.nofollow ?? base.seoDefaults.nofollow,
            robotsJson: cfg.seoDefaults.robotsJson ?? base.seoDefaults.robotsJson,
          }
        : base.seoDefaults,
    }
    if (!isDev) cache.set(postType, full)
    return full
  }
}

const postTypeConfigService = new PostTypeConfigService()
export default postTypeConfigService
