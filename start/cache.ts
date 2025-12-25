import redis from '@adonisjs/redis/services/main'
import cmsConfig from '#config/cms'
import app from '@adonisjs/core/services/app'

/**
 * Handle cache flushing on application start
 */
if (app.nodeEnvironment === 'development' || !cmsConfig.cache.enabled) {
	try {
		// We use a try/catch because Redis might not be available or 
		// connection might fail during boot in some environments
		await redis.flushdb()
		console.log('[cache] Redis database flushed (dev mode or cache disabled)')
	} catch (error) {
		// Silence error if redis is not connected yet, it will fail later if needed
	}
}



