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
 * Admin - Posts
 */
const PostsController = () => import('#controllers/posts_controller')
router.get('/admin/posts/:id/edit', [PostsController, 'edit']).use(middleware.auth())

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
const UsersController = () => import('#controllers/users_controller')
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
 * API Routes - Posts (Admin)
 */
router.group(() => {
	router.get('/posts', [PostsController, 'index'])
	router.get('/post-types', [PostsController, 'types'])
	router.post('/posts', [PostsController, 'store'])
	router.put('/posts/:id', [PostsController, 'update'])
	// Review API parity endpoints
	router.post('/review/posts/:id/save', [PostsController, 'reviewSave'])
	router.post('/review/posts/:id/approve', [PostsController, 'reviewApprove'])
	router.get('/posts/:id/export', [PostsController, 'exportJson'])
	router.post('/posts/import', [PostsController, 'importCreate'])
	router.post('/posts/:id/import', [PostsController, 'importInto'])
	router.get('/posts/:id/revisions', [PostsController, 'revisions'])
	router.post('/posts/:id/revisions/:revId/revert', [PostsController, 'revertRevision'])
	router.delete('/posts/:id', [PostsController, 'destroy']).use(middleware.admin())
	router.post('/posts/bulk', [PostsController, 'bulk'])
	router.post('/posts/reorder', [PostsController, 'reorder'])
	router.post('/posts/:id/modules', [PostsController, 'storeModule'])
	router.put('/post-modules/:id', [PostsController, 'updateModule'])
	router.delete('/post-modules/:id', [PostsController, 'deleteModule'])
	// Post author management (admin)
	router.patch('/posts/:id/author', [PostsController, 'updateAuthor']).use(middleware.admin())
	// Agents
	router.get('/agents', [AgentsController, 'index']).use(middleware.admin())
	router.post('/posts/:id/agents/:agentId/run', [AgentsController, 'runForPost']).use(middleware.admin())
	// Users (admin)
	router.get('/users', [UsersController, 'index']).use(middleware.admin())
	router.patch('/users/:id', [UsersController, 'update']).use(middleware.admin())
	router.patch('/users/:id/password', [UsersController, 'resetPassword']).use(middleware.admin())
	// Profiles (self)
	router.get('/profile/status', [UsersController, 'profileStatus'])
	router.post('/users/me/profile', [UsersController, 'createMyProfile'])
	// Media
	router.get('/media', [MediaController, 'index'])
	router.get('/media/categories', [MediaController, 'categories'])
	router.get('/media/:id', [MediaController, 'show'])
	router.get('/media/:id/where-used', [MediaController, 'whereUsed']).use(middleware.admin())
	router.post('/media', [MediaController, 'upload']).use(middleware.admin())
	router.post('/media/check-duplicate', [MediaController, 'checkDuplicate']).use(middleware.admin())
	router.post('/media/:id/override', [MediaController, 'override']).use(middleware.admin())
	router.patch('/media/:id', [MediaController, 'update']).use(middleware.admin())
	router.delete('/media/:id', [MediaController, 'destroy']).use(middleware.admin())
	router.post('/media/:id/variants', [MediaController, 'variants']).use(middleware.admin())
	router.patch('/media/:id/rename', [MediaController, 'rename']).use(middleware.admin())
	// Site Settings
	router.get('/site-settings', [SiteSettingsController, 'show'])
	router.patch('/site-settings', [SiteSettingsController, 'update']).use(middleware.admin())
	// Global/Static modules
	router.get('/modules/global', [GlobalModulesController, 'index']).use(middleware.admin())
	router.post('/modules/global', [GlobalModulesController, 'create']).use(middleware.admin())
	router.put('/modules/global/:id', [GlobalModulesController, 'update']).use(middleware.admin())
	router.delete('/modules/global/:id', [GlobalModulesController, 'destroy']).use(middleware.admin())
	router.get('/modules/static', [GlobalModulesController, 'index']).use(middleware.admin())
}).prefix('/api').use(middleware.auth())

/**
 * Public Routes - Posts
 */
router.get('/posts/:slug', [PostsController, 'show'])

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

// Deprecated: Post types settings moved to code configs

// Admin Media Library
router.get('/admin/media', async ({ inertia }) => {
	return inertia.render('admin/media/index')
}).use(middleware.auth()).use(middleware.admin())

// Admin Posts (list)
router.get('/admin/posts', async ({ inertia }) => {
	return inertia.render('admin/dashboard')
}).use(middleware.auth()).use(middleware.admin())

// Admin Profile (current user)
router.get('/admin/profile', async ({ inertia }) => {
	return inertia.render('admin/profile/index')
}).use(middleware.auth())

// Admin Global/Static Module Manager
router.get('/admin/modules', async ({ inertia }) => {
	return inertia.render('admin/modules/index')
}).use(middleware.auth()).use(middleware.admin())

// Admin Users (stub)
router.get('/admin/users', async ({ inertia }) => {
	return inertia.render('admin/users/index')
}).use(middleware.auth()).use(middleware.admin())

router.get('/admin/users/:id/edit', async ({ params, inertia }) => {
	return inertia.render('admin/users/edit', { id: params.id })
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

// Graceful forbidden page for non-admins
router.get('/admin/forbidden', async ({ inertia }) => {
	return inertia.render('admin/errors/forbidden')
}).use(middleware.auth())

/**
 * Catch-all: resolve posts by URL patterns (must be last)
 */
router.get('*', [PostsController, 'resolve'])
