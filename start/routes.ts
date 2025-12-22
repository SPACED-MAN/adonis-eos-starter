/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import '#start/taxonomies'
import { adminPath } from '#services/admin_path_service'

const SitemapController = () => import('#controllers/sitemap_controller')
const RobotsController = () => import('#controllers/robots_controller')
const SeoController = () => import('#controllers/seo_controller')
const SiteSearchController = () => import('#controllers/site_search_controller')

// Homepage - resolve from posts (slug: 'home', type: 'page')
// This delegates to the post resolution system
router.get('/', async ({ request, response, inertia, auth }) => {
  const { default: PostsViewController } = await import('#controllers/posts/posts_view_controller')
  const instance = new PostsViewController()
  // Manually set the request path to /home so the URL pattern matching works
  const originalUrl = request.url.bind(request)
  request.url = () => '/home'
  try {
    return await (instance as any).resolve({ request, response, inertia, auth })
  } finally {
    request.url = originalUrl
  }
}).use(middleware.maintenance())

// Public media info (no auth)
const MediaController = () => import('#controllers/media_controller')
router.get('/public/media/:id', [MediaController, 'showPublic'])

/**
 * Public search (static Inertia page)
 */
router.get('/search', [SiteSearchController, 'index'])

/**
 * Auth routes (admin)
 */
const AuthController = () => import('#controllers/auth_controller')
const PasswordResetsController = () => import('#controllers/auth/password_resets_controller')

router
  .get(adminPath('login'), [AuthController, 'showLogin'])
  .use(middleware.guest())
  .use(middleware.rateLimitAuth())
router
  .post(adminPath('login'), [AuthController, 'login'])
  .use(middleware.guest())
  .use(middleware.rateLimitAuth())

// Password Reset Routes
router
  .get(adminPath('forgot-password'), [PasswordResetsController, 'showForgot'])
  .use(middleware.guest())
router
  .post(adminPath('forgot-password'), [PasswordResetsController, 'sendEmail'])
  .use(middleware.guest())
  .use(middleware.rateLimitAuth())
router
  .get(adminPath('reset-password'), [PasswordResetsController, 'showReset'])
  .use(middleware.guest())
router
  .post(adminPath('reset-password'), [PasswordResetsController, 'reset'])
  .use(middleware.guest())
  .use(middleware.rateLimitAuth())

router.post(adminPath('logout'), [AuthController, 'logout']).use(middleware.auth())

/**
 * Admin home (protected)
 */
const Post = () => import('#models/post')
router
  .get(adminPath(), async ({ inertia }) => {
    const PostModel = await Post()
    const posts = await PostModel.default.query().orderBy('updated_at', 'desc').limit(10)

    return inertia.render('admin/home', {
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        locale: p.locale,
        updatedAt: p.updatedAt.toISO(),
      })),
    })
  })
  .use(middleware.auth())

/**
 * Split Post Controllers
 */
const PostsListController = () => import('#controllers/posts/posts_list_controller')
const PostsCrudController = () => import('#controllers/posts/posts_crud_controller')
const PostsViewController = () => import('#controllers/posts/posts_view_controller')
const PostsModulesController = () => import('#controllers/posts/posts_modules_controller')
const PostsRevisionsController = () => import('#controllers/posts/posts_revisions_controller')
const PostsExportController = () => import('#controllers/posts/posts_export_controller')
const InlineEditorController = () => import('#controllers/inline_editor_controller')

/**
 * Admin - Posts (using split controllers)
 */
router.get(adminPath('posts/:id/edit'), [PostsViewController, 'edit']).use(middleware.auth())

/**
 * API Routes - Locales
 */
const LocalesController = () => import('#controllers/locales_controller')
router
  .group(() => {
    router.get('/locales', [LocalesController, 'index'])
    router.get('/locales/:locale', [LocalesController, 'show'])
    router.patch('/locales/:locale', [LocalesController, 'update'])
    router.delete('/locales/:locale', [LocalesController, 'destroy'])
  })
  .prefix('/api')

/**
 * API Routes - Translations
 */
const TranslationsController = () => import('#controllers/translations_controller')
router
  .group(() => {
    router.get('/posts/:id/translations', [TranslationsController, 'index'])
    router.post('/posts/:id/translations', [TranslationsController, 'store'])
    router.get('/posts/:id/translations/:locale', [TranslationsController, 'show'])
    router.delete('/posts/:id/translations/:locale', [TranslationsController, 'destroy'])
  })
  .prefix('/api')
  .use(middleware.auth())

/**
 * API Routes - Inline editor (authenticated; permission checked in controller)
 */
router
  .group(() => {
    router.patch('/inline/posts/:postId/modules/:moduleId', [
      InlineEditorController,
      'updateModuleField',
    ])
  })
  .prefix('/api')
  .use(middleware.auth())

/**
 * API Routes - Modules
 */
const ModulesController = () => import('#controllers/modules_controller')
router
  .group(() => {
    router.get('/modules/registry', [ModulesController, 'registry'])
    router.get('/modules/:type/schema', [ModulesController, 'schema'])
  })
  .prefix('/api')

/**
 * API Routes - URL Patterns (Admin)
 */
const UrlPatternsController = () => import('#controllers/url_patterns_controller')
const SiteSettingsController = () => import('#controllers/site_settings_controller')
router
  .group(() => {
    router.get('/url-patterns', [UrlPatternsController, 'index'])
    router.put('/url-patterns/:locale', [UrlPatternsController, 'upsert'])
  })
  .prefix('/api')
  .use(middleware.auth())

/**
 * API Routes - Redirects (Admin)
 */
const UrlRedirectsController = () => import('#controllers/url_redirects_controller')
router
  .group(() => {
    router.get('/redirects', [UrlRedirectsController, 'index']).use(middleware.admin())
    router.post('/redirects', [UrlRedirectsController, 'store']).use(middleware.admin())
    router.put('/redirects/:id', [UrlRedirectsController, 'update']).use(middleware.admin())
    router.delete('/redirects/:id', [UrlRedirectsController, 'destroy']).use(middleware.admin())
    router
      .get('/redirect-settings/:postType', [UrlRedirectsController, 'getSettings'])
      .use(middleware.admin())
    router
      .post('/redirect-settings/:postType', [UrlRedirectsController, 'updateSettings'])
      .use(middleware.admin())
  })
  .prefix('/api')
  .use(middleware.auth())

/**
 * API Routes - Module Groups (Admin)
 */
const ModuleGroupsController = () => import('#controllers/module_groups_controller')
const AgentsController = () => import('#controllers/agents_controller')
const WorkflowsController = () => import('#controllers/workflows_controller')
const GlobalModulesController = () => import('#controllers/global_modules_controller')
const ProfilesController = () => import('#controllers/profiles_controller')
const BlogsController = () => import('#controllers/blogs_controller')
const CompaniesController = () => import('#controllers/companies_controller')
const TestimonialsController = () => import('#controllers/testimonials_controller')
const FormsController = () => import('#controllers/forms_controller')
const FormsAdminController = () => import('#controllers/forms_admin_controller')
const MenusController = () => import('#controllers/menus_controller')
const UsersController = () => import('#controllers/users_controller')
const TaxonomiesController = () => import('#controllers/taxonomies_controller')
const ProtectedAccessController = () => import('#controllers/protected_access_controller')
// MediaController imported above

// Public API for site chrome (no auth required)
router
  .group(() => {
    router.get('/menus/by-slug/:slug', [MenusController, 'bySlug'])
    router.get('/site-settings', [SiteSettingsController, 'show'])
    router.get('/public/posts', [PostsListController, 'publicIndex'])
  })
  .prefix('/api')

router
  .group(() => {
    router.get('/module-groups', [ModuleGroupsController, 'index']).use(middleware.admin())
    router.post('/module-groups', [ModuleGroupsController, 'store']).use(middleware.admin())
    router.put('/module-groups/:id', [ModuleGroupsController, 'update']).use(middleware.admin())
    router.delete('/module-groups/:id', [ModuleGroupsController, 'destroy']).use(middleware.admin())
    router
      .get('/module-groups/:id/modules', [ModuleGroupsController, 'listModules'])
      .use(middleware.admin())
    router
      .post('/module-groups/:id/modules', [ModuleGroupsController, 'addModule'])
      .use(middleware.admin())
    router
      .put('/module-groups/modules/:moduleId', [ModuleGroupsController, 'updateModule'])
      .use(middleware.admin())
    router
      .delete('/module-groups/modules/:moduleId', [ModuleGroupsController, 'deleteModule'])
      .use(middleware.admin())
  })
  .prefix('/api')
  .use(middleware.auth())
/**
 * API Routes - Posts (using split controllers)
 */
router
  .group(() => {
    // List & types
    router.get('/posts', [PostsListController, 'index'])
    router.get('/post-types', [PostsListController, 'types'])

    // CRUD operations
    router.post('/posts', [PostsCrudController, 'store'])
    router.put('/posts/:id', [PostsCrudController, 'update'])
    router.delete('/posts/:id', [PostsCrudController, 'destroy']).use(middleware.admin())
    router.post('/posts/:id/restore', [PostsCrudController, 'restore']).use(middleware.admin())
    router.post('/posts/bulk', [PostsCrudController, 'bulk'])
    router.post('/posts/reorder', [PostsCrudController, 'reorder'])
    router.patch('/posts/:id/author', [PostsCrudController, 'updateAuthor']).use(middleware.admin())
    router.post('/posts/:id/variations', [PostsCrudController, 'createVariation'])
    router.post('/posts/:id/promote-variation', [PostsCrudController, 'promoteVariation'])
    router.delete('/posts/:id/variation', [PostsCrudController, 'deleteVariation'])
    router.get('/posts/:id/ab-stats', [PostsCrudController, 'getAbStats'])

    // Modules
    router.post('/posts/:id/modules', [PostsModulesController, 'store'])
    router.put('/post-modules/:id', [PostsModulesController, 'update'])
    router.delete('/post-modules/:id', [PostsModulesController, 'destroy'])

    // Revisions
    router.get('/posts/:id/revisions', [PostsRevisionsController, 'index'])
    router.get('/posts/:id/revisions/:revId', [PostsRevisionsController, 'show'])
    router.post('/posts/:id/revisions/:revId/revert', [PostsRevisionsController, 'revert'])
    router.post('/posts/:id/revisions/:revId/compare', [PostsRevisionsController, 'compare'])

    // Export/Import
    router.get('/posts/:id/export', [PostsExportController, 'exportJson'])
    router.post('/posts/import', [PostsExportController, 'importCreate'])
    router.post('/posts/:id/import', [PostsExportController, 'importInto'])

    // Preview links
    router.post('/posts/:id/preview-link', [PostsViewController, 'createPreviewLink'])
    router.get('/posts/:id/preview-links', [PostsViewController, 'listPreviewLinks'])
    router.delete('/posts/:id/preview-links/:token', [PostsViewController, 'revokePreviewLink'])
    // Agents
    router.get('/agents', [AgentsController, 'index']).use(middleware.admin())
    router
      .post('/posts/:id/agents/:agentId/run', [AgentsController, 'runForPost'])
      .use(middleware.admin())
    router.post('/agents/:agentId/run', [AgentsController, 'runGlobal']).use(middleware.admin())
    router
      .get('/agents/:agentId/history', [AgentsController, 'getGlobalHistory'])
      .use(middleware.admin())
    router
      .get('/posts/:id/agents/:agentId/history', [AgentsController, 'getHistory'])
      .use(middleware.admin())
    // Workflows
    router.get('/workflows', [WorkflowsController, 'index']).use(middleware.admin())
    router.get('/workflows/:id', [WorkflowsController, 'show']).use(middleware.admin())
    router.post('/workflows/:id/trigger', [WorkflowsController, 'trigger']).use(middleware.admin())
    // Users (admin)
    router.post('/users', [UsersController, 'store']).use(middleware.admin())
    router.get('/users', [UsersController, 'index']).use(middleware.admin())
    router.patch('/users/:id', [UsersController, 'update']).use(middleware.admin())
    router.patch('/users/:id/password', [UsersController, 'resetPassword']).use(middleware.admin())
    router.delete('/users/:id', [UsersController, 'destroy']).use(middleware.admin())
    // Profiles (self) - place before param route to avoid ':id' capturing 'me'
    router.get('/profile/status', [UsersController, 'profileStatus'])
    router.post('/users/me/profile', [UsersController, 'createMyProfile'])
    // Admin: profile lookup/create for a given user id
    router.get('/users/:id/profile', [UsersController, 'profileForUser']).use(middleware.admin())
    router
      .post('/users/:id/profile', [UsersController, 'createProfileForUser'])
      .use(middleware.admin())
    // Media
    router.get('/media', [MediaController, 'index'])
    router.get('/media/categories', [MediaController, 'categories'])
    router.get('/media/:id', [MediaController, 'show'])
    router.get('/media/:id/where-used', [MediaController, 'whereUsed']).use(middleware.admin())
    router.post('/media', [MediaController, 'upload']).use(middleware.admin())
    router
      .post('/media/check-duplicate', [MediaController, 'checkDuplicate'])
      .use(middleware.admin())
    router.post('/media/:id/override', [MediaController, 'override']).use(middleware.admin())
    router.post('/media/:id/optimize', [MediaController, 'optimize']).use(middleware.auth())
    router.post('/media/optimize-bulk', [MediaController, 'optimizeBulk']).use(middleware.auth())
    router.post('/media/variants-bulk', [MediaController, 'variantsBulk']).use(middleware.auth())
    router.post('/media/delete-bulk', [MediaController, 'deleteBulk']).use(middleware.admin())
    router
      .post('/media/categories-bulk', [MediaController, 'categoriesBulk'])
      .use(middleware.auth())
    router.patch('/media/:id', [MediaController, 'update']).use(middleware.admin())
    router.delete('/media/:id', [MediaController, 'destroy']).use(middleware.admin())
    router.post('/media/:id/variants', [MediaController, 'variants']).use(middleware.admin())
    router.patch('/media/:id/rename', [MediaController, 'rename']).use(middleware.admin())
    // Site Settings
    router.patch('/site-settings', [SiteSettingsController, 'update']).use(middleware.admin())
    // Menus (Admin)
    router.get('/menus', [MenusController, 'index'])
    router.post('/menus', [MenusController, 'store']).use(middleware.admin())
    router.get('/menus/:id', [MenusController, 'show'])
    router.put('/menus/:id', [MenusController, 'update']).use(middleware.admin())
    router.delete('/menus/:id', [MenusController, 'destroy']).use(middleware.admin())
    router.post('/menus/:id/items', [MenusController, 'storeItem'])
    router.put('/menu-items/:id', [MenusController, 'updateItem'])
    router.delete('/menu-items/:id', [MenusController, 'destroyItem'])
    router.post('/menus/:id/reorder', [MenusController, 'reorder'])
    router
      .post('/menus/:id/generate-variations', [MenusController, 'generateVariations'])
      .use(middleware.admin())
    router.get('/menu-templates', [MenusController, 'templates']).use(middleware.admin())
    // Global/Static modules
    router.get('/modules/global', [GlobalModulesController, 'index']).use(middleware.admin())
    router.post('/modules/global', [GlobalModulesController, 'create']).use(middleware.admin())
    router.put('/modules/global/:id', [GlobalModulesController, 'update']).use(middleware.admin())
    router
      .delete('/modules/global/:id', [GlobalModulesController, 'destroy'])
      .use(middleware.admin())
    router.get('/modules/static', [GlobalModulesController, 'index']).use(middleware.admin())
    // Forms definitions
    router.get('/forms-definitions', [FormsAdminController, 'listDefinitions'])
    // Form submissions
    router.get('/forms-submissions/export', [FormsAdminController, 'exportCsv'])
    router.post('/forms-submissions/bulk-delete', [FormsAdminController, 'bulkDelete'])
    router.delete('/forms-submissions/:id', [FormsAdminController, 'deleteSubmission'])
    // Taxonomies (editors allowed)
    router.get('/taxonomies', [TaxonomiesController, 'list'])
    router.get('/taxonomies/:slug/terms', [TaxonomiesController, 'termsBySlug'])
    router.post('/taxonomies/:slug/terms', [TaxonomiesController, 'createTerm'])
    router.patch('/taxonomy-terms/:id', [TaxonomiesController, 'updateTerm'])
    router.delete('/taxonomy-terms/:id', [TaxonomiesController, 'destroyTerm'])
    router.get('/taxonomy-terms/:id/posts', [TaxonomiesController, 'postsForTerm'])
  })
  .prefix('/api')
  .use(middleware.auth())

/**
 * API Routes - Profiles / Blogs / Companies (public)
 *
 * Dedicated endpoints for specific post types, to keep /api/posts generic.
 */
router
  .group(() => {
    router.get('/profiles', [ProfilesController, 'index'])
    router.get('/blogs', [BlogsController, 'index'])
    router.get('/companies', [CompaniesController, 'index'])
    router.get('/testimonials', [TestimonialsController, 'index'])
    router.get('/forms/:slug', [FormsController, 'show'])
    router.post('/forms/:slug', [FormsController, 'submit'])
  })
  .prefix('/api')

/**
 * API Routes - Webhooks (Admin)
 */
const WebhooksController = () => import('#controllers/webhooks_controller')
router
  .group(() => {
    router.get('/webhooks', [WebhooksController, 'index'])
    router.post('/webhooks', [WebhooksController, 'store'])
    router.put('/webhooks/:id', [WebhooksController, 'update'])
    router.delete('/webhooks/:id', [WebhooksController, 'destroy'])
    router.get('/webhooks/:id/deliveries', [WebhooksController, 'deliveries'])
    router.post('/webhooks/:id/test', [WebhooksController, 'test'])
  })
  .prefix('/api')
  .use(middleware.auth())
  .use(middleware.admin())

/**
 * SEO endpoints (admin)
 */
router
  .group(() => {
    router.get('/seo/sitemap/status', [SeoController, 'sitemapStatus'])
    router.post('/seo/sitemap/rebuild', [SeoController, 'sitemapRebuild'])
  })
  .prefix('/api')
  .use(middleware.auth())
  .use(middleware.admin())

/**
 * Security endpoints (admin)
 */
const SecurityController = () => import('#controllers/security_controller')
router
  .group(() => {
    router.get('/security/sessions', [SecurityController, 'sessions'])
    router.delete('/security/sessions/:sessionId', [SecurityController, 'revokeSession'])
    router.post('/security/sessions/revoke-all', [SecurityController, 'revokeAllSessions'])
    router.get('/security/audit-logs', [SecurityController, 'auditLogs'])
    router.get('/security/posture', [SecurityController, 'posture'])
    router.get('/security/webhooks', [SecurityController, 'webhooks'])
    router.get('/security/login-history', [SecurityController, 'loginHistory'])
  })
  .prefix('/api')
  .use(middleware.auth())
  .use(middleware.admin())

/**
 * Preview Routes (with token validation)
 */
router.get('/preview/:id', [PostsViewController, 'preview'])

// (Catch-all added at the very end of file)

/**
 * Admin Settings Pages
 */
router
  .get(adminPath('settings/url-patterns'), async ({ inertia }) => {
    return inertia.render('admin/settings/url-patterns')
  })
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get(adminPath('settings/redirects'), async ({ inertia }) => {
    return inertia.render('admin/settings/redirects')
  })
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get(adminPath('settings/locales'), async ({ inertia }) => {
    return inertia.render('admin/settings/locales')
  })
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get(adminPath('settings/module-groups'), async ({ inertia }) => {
    return inertia.render('admin/settings/module-groups')
  })
  .use(middleware.auth())
  .use(middleware.admin())

// Admin Media Library (editors allowed)
router
  .get(adminPath('media'), async ({ inertia }) => {
    return inertia.render('admin/media/index')
  })
  .use(middleware.auth())

// Admin Posts (list) (editors allowed)
router
  .get(adminPath('posts'), async ({ inertia }) => {
    return inertia.render('admin/posts/index')
  })
  .use(middleware.auth())

// Admin Profile (current user)
router
  .get(adminPath('profile'), async ({ inertia }) => {
    return inertia.render('admin/profile/index')
  })
  .use(middleware.auth())

// Admin Global/Static Module Manager
router
  .get(adminPath('modules'), async ({ inertia }) => {
    return inertia.render('admin/modules/index')
  })
  .use(middleware.auth())
  .use(middleware.admin())

// Admin Forms (submissions) - editors allowed
router.get(adminPath('forms'), [FormsAdminController, 'index']).use(middleware.auth())

// Admin Menus - editors allowed
router
  .get(adminPath('menus'), async ({ inertia }) => {
    return inertia.render('admin/menus/index')
  })
  .use(middleware.auth())

// Admin Categories (Taxonomies) (editors allowed)
router
  .get(adminPath('categories'), async ({ inertia }) => {
    return inertia.render('admin/categories')
  })
  .use(middleware.auth())

// Admin Users (stub)
router
  .get(adminPath('users'), async ({ inertia }) => {
    return inertia.render('admin/users/index')
  })
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get(adminPath('users/:id/edit'), async ({ params, inertia }) => {
    return inertia.render('admin/users/edit', { id: params.id })
  })
  .use(middleware.auth())
  .use(middleware.admin())

// Admin Security Center
router
  .get(adminPath('security'), [SecurityController, 'index'])
  .use(middleware.auth())
  .use(middleware.admin())

// Admin Database (Export/Import and Optimize)
const DatabaseAdminController = () => import('#controllers/database_admin_controller')
router
  .get(adminPath('database'), [DatabaseAdminController, 'index'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get('/api/database/export/stats', [DatabaseAdminController, 'getExportStats'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get('/api/database/export', [DatabaseAdminController, 'export'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .post('/api/database/import', [DatabaseAdminController, 'import'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .post('/api/database/validate', [DatabaseAdminController, 'validate'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get('/api/database/optimize/stats', [DatabaseAdminController, 'getOptimizeStats'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .post('/api/database/optimize', [DatabaseAdminController, 'optimize'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get('/api/database/find-replace/tables', [DatabaseAdminController, 'getFindReplaceTables'])
  .use(middleware.auth())
  .use(middleware.admin())

router
  .post('/api/database/find-replace', [DatabaseAdminController, 'findReplace'])
  .use(middleware.auth())
  .use(middleware.admin())

// Admin General Settings
router
  .get(adminPath('settings/general'), async ({ inertia }) => {
    return inertia.render('admin/settings/general')
  })
  .use(middleware.auth())
  .use(middleware.admin())

router
  .get(adminPath('settings/seo'), async ({ inertia }) => {
    return inertia.render('admin/settings/seo')
  })
  .use(middleware.auth())
  .use(middleware.admin())
/**
 * Protected content access
 */
router.get('/protected', [ProtectedAccessController, 'showForm'])
router
  .post('/protected/login', [ProtectedAccessController, 'login'])
  .use(middleware.rateLimitAuth())

// Graceful forbidden page for non-admins
router
  .get(adminPath('forbidden'), async ({ inertia }) => {
    return inertia.render('admin/errors/forbidden')
  })
  .use(middleware.auth())

/**
 * Health check endpoint (for load balancers and monitoring)
 */
router.get('/health', async ({ response }) => {
  return response.ok({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

/**
 * robots.txt
 */
router.get('/robots.txt', [RobotsController, 'index'])

/**
 * XML Sitemap
 */
router.get('/sitemap.xml', [SitemapController, 'index'])

/**
 * Catch-all: resolve posts by URL patterns (must be last)
 */
router.get('*', [PostsViewController, 'resolve']).use(middleware.maintenance())
