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

	return inertia.render('admin/dashboard', {
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
	router.get('/redirect-settings/:postType', [UrlRedirectsController, 'getSetting']).use(middleware.admin())
	router.patch('/redirect-settings/:postType', [UrlRedirectsController, 'updateSetting']).use(middleware.admin())
}).prefix('/api').use(middleware.auth())

/**
 * API Routes - Templates (Admin)
 */
const TemplatesController = () => import('#controllers/templates_controller')
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
	router.get('/posts/:id/export', [PostsController, 'exportJson'])
	router.post('/posts/import', [PostsController, 'importCreate'])
	router.post('/posts/:id/import', [PostsController, 'importInto'])
	router.get('/posts/:id/revisions', [PostsController, 'revisions'])
	router.post('/posts/:id/revisions/:revId/revert', [PostsController, 'revertRevision'])
	router.delete('/posts/:id', [PostsController, 'destroy']).use(middleware.admin())
	router.post('/posts/bulk', [PostsController, 'bulk'])
	router.post('/posts/:id/modules', [PostsController, 'storeModule'])
	router.put('/post-modules/:id', [PostsController, 'updateModule'])
	router.delete('/post-modules/:id', [PostsController, 'deleteModule'])
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

