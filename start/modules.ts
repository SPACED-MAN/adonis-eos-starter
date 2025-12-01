/**
 * Module System Bootstrap
 *
 * Registers all available modules with the module registry.
 * This file is loaded on application startup.
 */

import moduleRegistry from '#services/module_registry'
import ProseModule from '#modules/prose'
import KitchenSinkModule from '#modules/kitchen_sink'
import FeedModule from '#modules/feed'
import BlogNoteModule from '#modules/blog_note'
import HeroWithMediaModule from '#modules/hero_with_media'
import HeroWithCalloutModule from '#modules/hero_with_callout'
import FeaturesListModule from '#modules/features_list'
import ProfileListModule from '#modules/profile_list'
import ProseWithMediaModule from '#modules/prose_with_media'
import StatisticsModule from '#modules/statistics'

// Register Hero modules
moduleRegistry.register(new HeroWithMediaModule())
moduleRegistry.register(new HeroWithCalloutModule())
moduleRegistry.register(new FeaturesListModule())
moduleRegistry.register(new ProfileListModule())
moduleRegistry.register(new ProseWithMediaModule())
moduleRegistry.register(new StatisticsModule())
// Register Prose module
moduleRegistry.register(new ProseModule())
// Register Kitchen Sink module (demo)
moduleRegistry.register(new KitchenSinkModule())
// Register Feed module
moduleRegistry.register(new FeedModule())
// Register Blog Note (blog-specific) module
moduleRegistry.register(new BlogNoteModule())

// Log registered modules (development only)
if (process.env.NODE_ENV === 'development') {
  const types = moduleRegistry.getTypes()
  console.log(`📦 Registered ${types.length} modules: ${types.join(', ')}`)
}

