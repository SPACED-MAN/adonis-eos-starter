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
const PatternsController = () => import('#controllers/patterns_controller')
router.group(() => {
	router.get('/url-patterns', [PatternsController, 'index'])
	router.put('/url-patterns/:locale', [PatternsController, 'upsert'])
}).prefix('/api').use(middleware.auth())

/**
 * API Routes - Redirects (Admin)
 */
const RedirectsController = () => import('#controllers/redirects_controller')
router.group(() => {
	router.get('/redirects', [RedirectsController, 'index'])
	router.post('/redirects', [RedirectsController, 'store'])
	router.put('/redirects/:id', [RedirectsController, 'update'])
	router.delete('/redirects/:id', [RedirectsController, 'destroy'])
}).prefix('/api').use(middleware.auth())

/**
 * API Routes - Posts (Admin)
 */
router.group(() => {
	router.post('/posts', [PostsController, 'store'])
	router.put('/posts/:id', [PostsController, 'update'])
	router.post('/posts/:id/modules', [PostsController, 'storeModule'])
	router.put('/post-modules/:id', [PostsController, 'updateModule'])
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
}).use(middleware.auth())

router.get('/admin/settings/redirects', async ({ inertia }) => {
	return inertia.render('admin/settings/redirects')
}).use(middleware.auth())

router.get('/admin/settings/locales', async ({ inertia }) => {
	return inertia.render('admin/settings/locales')
}).use(middleware.auth())

/**
 * Catch-all: resolve posts by URL patterns (must be last)
 */
router.get('*', [PostsController, 'resolve'])

