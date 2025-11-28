import templates from '#services/menu_template_registry'
import primary from './primary.ts'

// This file exists to ensure templates are imported at boot
export function listMenuTemplates() {
  return templates.list()
}

export function getMenuTemplate(slug: string) {
  return templates.get(slug)
}

export default {
  list: listMenuTemplates,
  get: getMenuTemplate,
  // Exporting modules to avoid “unused import” elimination in some bundlers
  _exports: { primary },
}


