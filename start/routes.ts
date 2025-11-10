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
router.get('/admin', async ({ inertia }) => {
	return inertia.render('admin/dashboard')
}).use(middleware.auth())

/**
 * API Routes - Locales
 */
const LocalesController = () => import('#controllers/locales_controller')
router.group(() => {
	router.get('/locales', [LocalesController, 'index'])
	router.get('/locales/:locale', [LocalesController, 'show'])
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
 * API Routes - Posts
 */
const PostsController = () => import('#controllers/posts_controller')
router.group(() => {
	router.post('/posts', [PostsController, 'store'])
	router.put('/posts/:id', [PostsController, 'update'])
	router.post('/posts/:id/modules', [PostsController, 'storeModule'])
	router.put('/post-modules/:id', [PostsController, 'updateModule'])
}).prefix('/api').use(middleware.auth())

// Public post viewing endpoint
router.get('/api/posts/:slug', [PostsController, 'show'])

