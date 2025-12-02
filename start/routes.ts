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

router.on('/').renderInertia('site/home')

// Public media info (no auth)
const MediaController = () => import('#controllers/media_controller')
router.get('/public/media/:id', [MediaController, 'showPublic'])

/**
 * Auth routes (admin)
 */
const AuthController = () => import('#controllers/auth_controller')
router.get('/admin/login', [AuthController, 'showLogin']).use(middleware.guest())
router.post('/admin/login', [AuthController, 'login']).use(middleware.guest())
router.post('/admin/logout', [AuthController, 'logout']).use(middleware.auth())

/**
 * Admin home (protected)
 */
const Post = () => import('#models/post')
router.get('/admin', async ({ inertia }) => {
	const PostModel = await Post()
	const posts = await PostModel.default.query().orderBy('updated_at', 'desc').limit(10)

	return inertia.render('admin/home', {
		posts: posts.map(p => ({
			id: p.id,
			title: p.title,
			slug: p.slug,
			status: p.status,
			locale: p.locale,
			updatedAt: p.updatedAt.toISO(),
		}))
	})
}).use(middleware.auth())

/**
 * Split Post Controllers
 */
const PostsListController = () => import('#controllers/posts/posts_list_controller')
const PostsCrudController = () => import('#controllers/posts/posts_crud_controller')
const PostsViewController = () => import('#controllers/posts/posts_view_controller')
const PostsModulesController = () => import('#controllers/posts/posts_modules_controller')
const PostsRevisionsController = () => import('#controllers/posts/posts_revisions_controller')
const PostsExportController = () => import('#controllers/posts/posts_export_controller')

/**
 * Admin - Posts (using split controllers)
 */
router.get('/admin/posts/:id/edit', [PostsViewController, 'edit']).use(middleware.auth())

/**
 * API Routes - Locales
 */
const LocalesController = () => import('#controllers/locales_controller')
router.group(() => {
	router.get('/locales', [LocalesController, 'index'])
	router.get('/locales/:locale', [LocalesController, 'show'])
	router.patch('/locales/:locale', [LocalesController, 'update'])
	router.delete('/locales/:locale', [LocalesController, 'destroy'])
}).prefix('/api')

/**
 * API Routes - Translations
 */
const TranslationsController = () => import('#controllers/translations_controller')
router.group(() => {
	router.get('/posts/:id/translations', [TranslationsController, 'index'])
	router.post('/posts/:id/translations', [TranslationsController, 'store'])
	router.get('/posts/:id/translations/:locale', [TranslationsController, 'show'])
	router.delete('/posts/:id/translations/:locale', [TranslationsController, 'destroy'])
}).prefix('/api').use(middleware.auth())

/**
 * API Routes - Modules
 */
const ModulesController = () => import('#controllers/modules_controller')
router.group(() => {
	router.get('/modules/registry', [ModulesController, 'registry'])
	router.get('/modules/:type/schema', [ModulesController, 'schema'])
}).prefix('/api')

/**
 * API Routes - URL Patterns (Admin)
 */
const UrlPatternsController = () => import('#controllers/url_patterns_controller')
const SiteSettingsController = () => import('#controllers/site_settings_controller')
router.group(() => {
	router.get('/url-patterns', [UrlPatternsController, 'index'])
	router.put('/url-patterns/:locale', [UrlPatternsController, 'upsert'])
}).prefix('/api').use(middleware.auth())

/**
 * API Routes - Redirects (Admin)
 */
const UrlRedirectsController = () => import('#controllers/url_redirects_controller')
router.group(() => {
	router.get('/redirects', [UrlRedirectsController, 'index']).use(middleware.admin())
	router.post('/redirects', [UrlRedirectsController, 'store']).use(middleware.admin())
	router.put('/redirects/:id', [UrlRedirectsController, 'update']).use(middleware.admin())
	router.delete('/redirects/:id', [UrlRedirectsController, 'destroy']).use(middleware.admin())
}).prefix('/api').use(middleware.auth())

/**
 * API Routes - Templates (Admin)
 */
const TemplatesController = () => import('#controllers/templates_controller')
const AgentsController = () => import('#controllers/agents_controller')
const GlobalModulesController = () => import('#controllers/global_modules_controller')
const ProfilesController = () => import('#controllers/profiles_controller')
const BlogsController = () => import('#controllers/blogs_controller')
const CompaniesController = () => import('#controllers/companies_controller')
const TestimonialsController = () => import('#controllers/testimonials_controller')
const MenusController = () => import('#controllers/menus_controller')
const UsersController = () => import('#controllers/users_controller')
const ActivityLogsController = () => import('#controllers/activity_logs_controller')
const TaxonomiesController = () => import('#controllers/taxonomies_controller')
const ProtectedAccessController = () => import('#controllers/protected_access_controller')
// MediaController imported above
router.group(() => {
	router.get('/templates', [TemplatesController, 'index']).use(middleware.admin())
	router.post('/templates', [TemplatesController, 'store']).use(middleware.admin())
	router.put('/templates/:id', [TemplatesController, 'update']).use(middleware.admin())
	router.delete('/templates/:id', [TemplatesController, 'destroy']).use(middleware.admin())
	router.get('/templates/:id/modules', [TemplatesController, 'listModules']).use(middleware.admin())
	router.post('/templates/:id/modules', [TemplatesController, 'addModule']).use(middleware.admin())
	router.put('/templates/modules/:moduleId', [TemplatesController, 'updateModule']).use(middleware.admin())
	router.delete('/templates/modules/:moduleId', [TemplatesController, 'deleteModule']).use(middleware.admin())
}).prefix('/api').use(middleware.auth())
/**
 * API Routes - Posts (using split controllers)
 */
router.group(() => {
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
	router.post('/posts/:id/agents/:agentId/run', [AgentsController, 'runForPost']).use(middleware.admin())
	// Users (admin)
	router.get('/users', [UsersController, 'index']).use(middleware.admin())
	router.patch('/users/:id', [UsersController, 'update']).use(middleware.admin())
	router.patch('/users/:id/password', [UsersController, 'resetPassword']).use(middleware.admin())
	router.delete('/users/:id', [UsersController, 'destroy']).use(middleware.admin())
	// Profiles (self) - place before param route to avoid ':id' capturing 'me'
	router.get('/profile/status', [UsersController, 'profileStatus'])
	router.post('/users/me/profile', [UsersController, 'createMyProfile'])
	// Admin: profile lookup/create for a given user id
	router.get('/users/:id/profile', [UsersController, 'profileForUser']).use(middleware.admin())
	router.post('/users/:id/profile', [UsersController, 'createProfileForUser']).use(middleware.admin())
	// Activity Logs (admin)
	router.get('/activity-logs', [ActivityLogsController, 'index']).use(middleware.admin())
	// Media
	router.get('/media', [MediaController, 'index'])
	router.get('/media/categories', [MediaController, 'categories'])
	router.get('/media/:id', [MediaController, 'show'])
	router.get('/media/:id/where-used', [MediaController, 'whereUsed']).use(middleware.admin())
	router.post('/media', [MediaController, 'upload']).use(middleware.admin())
	router.post('/media/check-duplicate', [MediaController, 'checkDuplicate']).use(middleware.admin())
	router.post('/media/:id/override', [MediaController, 'override']).use(middleware.admin())
	router.post('/media/:id/optimize', [MediaController, 'optimize']).use(middleware.auth())
	router.post('/media/optimize-bulk', [MediaController, 'optimizeBulk']).use(middleware.auth())
	router.post('/media/variants-bulk', [MediaController, 'variantsBulk']).use(middleware.auth())
	router.post('/media/delete-bulk', [MediaController, 'deleteBulk']).use(middleware.admin())
	router.post('/media/categories-bulk', [MediaController, 'categoriesBulk']).use(middleware.auth())
	router.patch('/media/:id', [MediaController, 'update']).use(middleware.admin())
	router.delete('/media/:id', [MediaController, 'destroy']).use(middleware.admin())
	router.post('/media/:id/variants', [MediaController, 'variants']).use(middleware.admin())
	router.patch('/media/:id/rename', [MediaController, 'rename']).use(middleware.admin())
	// Site Settings
	router.get('/site-settings', [SiteSettingsController, 'show'])
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
	router.post('/menus/:id/generate-variations', [MenusController, 'generateVariations']).use(middleware.admin())
	router.get('/menus/by-slug/:slug', [MenusController, 'bySlug'])
	router.get('/menu-templates', [MenusController, 'templates']).use(middleware.admin())
	// Global/Static modules
	router.get('/modules/global', [GlobalModulesController, 'index']).use(middleware.admin())
	router.post('/modules/global', [GlobalModulesController, 'create']).use(middleware.admin())
	router.put('/modules/global/:id', [GlobalModulesController, 'update']).use(middleware.admin())
	router.delete('/modules/global/:id', [GlobalModulesController, 'destroy']).use(middleware.admin())
	router.get('/modules/static', [GlobalModulesController, 'index']).use(middleware.admin())
	// Taxonomies (editors allowed)
	router.get('/taxonomies', [TaxonomiesController, 'list'])
	router.get('/taxonomies/:slug/terms', [TaxonomiesController, 'termsBySlug'])
	router.post('/taxonomies/:slug/terms', [TaxonomiesController, 'createTerm'])
	router.patch('/taxonomy-terms/:id', [TaxonomiesController, 'updateTerm'])
	router.delete('/taxonomy-terms/:id', [TaxonomiesController, 'destroyTerm'])
	router.get('/taxonomy-terms/:id/posts', [TaxonomiesController, 'postsForTerm'])
}).prefix('/api').use(middleware.auth())

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
	})
	.prefix('/api')

/**
 * API Routes - Webhooks (Admin)
 */
const WebhooksController = () => import('#controllers/webhooks_controller')
router.group(() => {
	router.get('/webhooks', [WebhooksController, 'index'])
	router.post('/webhooks', [WebhooksController, 'store'])
	router.put('/webhooks/:id', [WebhooksController, 'update'])
	router.delete('/webhooks/:id', [WebhooksController, 'destroy'])
	router.get('/webhooks/:id/deliveries', [WebhooksController, 'deliveries'])
	router.post('/webhooks/:id/test', [WebhooksController, 'test'])
}).prefix('/api').use(middleware.auth()).use(middleware.admin())

/**
 * Public Routes - Posts
 */
router.get('/posts/:slug', [PostsViewController, 'show'])

/**
 * Preview Routes (with token validation)
 */
router.get('/preview/:id', [PostsViewController, 'preview'])

// (Catch-all added at the very end of file)

/**
 * Admin Settings Pages
 */
router.get('/admin/settings/url-patterns', async ({ inertia }) => {
	return inertia.render('admin/settings/url-patterns')
}).use(middleware.auth()).use(middleware.admin())

router.get('/admin/settings/redirects', async ({ inertia }) => {
	return inertia.render('admin/settings/redirects')
}).use(middleware.auth()).use(middleware.admin())

router.get('/admin/settings/locales', async ({ inertia }) => {
	return inertia.render('admin/settings/locales')
}).use(middleware.auth()).use(middleware.admin())

router.get('/admin/settings/templates', async ({ inertia }) => {
	return inertia.render('admin/settings/templates')
}).use(middleware.auth()).use(middleware.admin())

// Admin Media Library (editors allowed)
router.get('/admin/media', async ({ inertia }) => {
	return inertia.render('admin/media/index')
}).use(middleware.auth())

// Admin Posts (list) (editors allowed)
router.get('/admin/posts', async ({ inertia }) => {
	return inertia.render('admin/dashboard')
}).use(middleware.auth())

// Admin Profile (current user)
router.get('/admin/profile', async ({ inertia }) => {
	return inertia.render('admin/profile/index')
}).use(middleware.auth())

// Admin Global/Static Module Manager
router.get('/admin/modules', async ({ inertia }) => {
	return inertia.render('admin/modules/index')
}).use(middleware.auth()).use(middleware.admin())

// Admin Menus
router.get('/admin/menus', async ({ inertia }) => {
	return inertia.render('admin/menus/index')
}).use(middleware.auth()).use(middleware.admin())

// Admin Categories (Taxonomies) (editors allowed)
router.get('/admin/categories', async ({ inertia }) => {
	return inertia.render('admin/categories')
}).use(middleware.auth())

// Admin Users (stub)
router.get('/admin/users', async ({ inertia }) => {
	return inertia.render('admin/users/index')
}).use(middleware.auth()).use(middleware.admin())

router.get('/admin/users/:id/edit', async ({ params, inertia }) => {
	return inertia.render('admin/users/edit', { id: params.id })
}).use(middleware.auth()).use(middleware.admin())

// Admin Activity Log
router.get('/admin/users/activity', async ({ inertia }) => {
	return inertia.render('admin/users/activity')
}).use(middleware.auth()).use(middleware.admin())

// Admin General Settings
router.get('/admin/settings/general', async ({ inertia }) => {
	return inertia.render('admin/settings/general')
}).use(middleware.auth()).use(middleware.admin())
// Templates list and editor pages (new)
router.get('/admin/templates', async ({ inertia }) => {
	return inertia.render('admin/templates/index')
}).use(middleware.auth()).use(middleware.admin())

router.get('/admin/templates/:id/edit', async ({ params, inertia }) => {
	return inertia.render('admin/templates/editor', { templateId: params.id })
}).use(middleware.auth()).use(middleware.admin())

/**
 * Protected content access
 */
router.get('/protected', [ProtectedAccessController, 'showForm'])
router.post('/protected/login', [ProtectedAccessController, 'login'])

// Graceful forbidden page for non-admins
router.get('/admin/forbidden', async ({ inertia }) => {
	return inertia.render('admin/errors/forbidden')
}).use(middleware.auth())

/**
 * Catch-all: resolve posts by URL patterns (must be last)
 */
router.get('*', [PostsViewController, 'resolve'])
