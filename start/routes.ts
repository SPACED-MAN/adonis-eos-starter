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

