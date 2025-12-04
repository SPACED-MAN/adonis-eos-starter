/**
 * Module System Bootstrap
 *
 * Registers all available modules with the module registry.
 * This file is loaded on application startup.
 */

import moduleRegistry from '#services/module_registry'
import ProseModule from '#modules/prose'
import KitchenSinkModule from '#modules/kitchen_sink'
import BlogNoteModule from '#modules/blog_note'
import HeroWithMediaModule from '#modules/hero_with_media'
import HeroWithCalloutModule from '#modules/hero_with_callout'
import FeaturesListModule from '#modules/features_list'
import FeaturesListExpandedModule from '#modules/features_list_expanded'
import BlockquoteModule from '#modules/blockquote'
import ProfileListModule from '#modules/profile_list'
import CompanyListModule from '#modules/company_list'
import ProseWithMediaModule from '#modules/prose_with_media'
import ProseWithFormModule from '#modules/prose_with_form'
import StatisticsModule from '#modules/statistics'
import PricingModule from '#modules/pricing'
import FaqModule from '#modules/faq'
import BlogListModule from '#modules/blog_list'
import TestimonialListModule from '#modules/testimonial_list'
import FormModule from '#modules/form'

// Register Hero modules
moduleRegistry.register(new HeroWithMediaModule())
moduleRegistry.register(new HeroWithCalloutModule())
moduleRegistry.register(new FeaturesListModule())
moduleRegistry.register(new FeaturesListExpandedModule())
moduleRegistry.register(new BlockquoteModule())
moduleRegistry.register(new ProfileListModule())
moduleRegistry.register(new CompanyListModule())
moduleRegistry.register(new BlogListModule())
moduleRegistry.register(new TestimonialListModule())
moduleRegistry.register(new ProseWithMediaModule())
moduleRegistry.register(new ProseWithFormModule())
moduleRegistry.register(new StatisticsModule())
moduleRegistry.register(new PricingModule())
moduleRegistry.register(new FaqModule())
moduleRegistry.register(new FormModule())
// Register Prose module
moduleRegistry.register(new ProseModule())
// Register Kitchen Sink module (demo)
moduleRegistry.register(new KitchenSinkModule())
// Register Blog Note (blog-specific) module
moduleRegistry.register(new BlogNoteModule())

// Log registered modules (development only)
if (process.env.NODE_ENV === 'development') {
  const types = moduleRegistry.getTypes()
  console.log(`📦 Registered ${types.length} modules: ${types.join(', ')}`)
}
