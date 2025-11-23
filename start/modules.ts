/**
 * Module System Bootstrap
 *
 * Registers all available modules with the module registry.
 * This file is loaded on application startup.
 */

import moduleRegistry from '#services/module_registry'
import HeroModule from '#modules/hero'
import ProseModule from '#modules/prose'
import KitchenSinkModule from '#modules/kitchen_sink'
import FeedModule from '#modules/feed'

// Register Hero module
moduleRegistry.register(new HeroModule())
// Register Prose module
moduleRegistry.register(new ProseModule())
// Register Kitchen Sink module (demo)
moduleRegistry.register(new KitchenSinkModule())
// Register Feed module
moduleRegistry.register(new FeedModule())

// Log registered modules (development only)
if (process.env.NODE_ENV === 'development') {
  const types = moduleRegistry.getTypes()
  console.log(`📦 Registered ${types.length} modules: ${types.join(', ')}`)
}

