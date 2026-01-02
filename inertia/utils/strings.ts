export function humanizeSlug(input: string | null | undefined): string {
  if (!input) return ''
  return String(input)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function slugify(input: string | null | undefined): string {
  if (!input) return ''
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate unique anchor IDs for a list of modules.
 * If multiple modules have the same slugified label/type, appends -2, -3 etc.
 */
export function getModuleAnchors(
  modules: Array<{ id: string; type: string; adminLabel?: string | null }>
): Map<string, string> {
  const seenSlugs = new Map<string, number>()
  const anchors = new Map<string, string>()

  for (const m of modules) {
    const baseSlug = slugify(m.adminLabel || m.type)
    const count = seenSlugs.get(baseSlug) || 0
    const finalSlug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`

    anchors.set(m.id, `#${finalSlug}`)
    seenSlugs.set(baseSlug, count + 1)
  }

  return anchors
}
