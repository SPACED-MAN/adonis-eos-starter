/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import '../css/app.css';
import { hydrateRoot, createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { Toaster } from '../components/ui/sonner'

const appName = import.meta.env.VITE_APP_NAME || 'EOS'

createInertiaApp({
	progress: { 
		color: '#5468FF',
		// Delay showing progress bar to avoid flicker on fast navigations
		delay: 250,
	},

	title: (title) => `${title} - ${appName}`,

	resolve: (name) => {
		// Strip "admin/" prefix if present
		const pageName = name.startsWith('admin/') ? name.replace('admin/', '') : name
		return resolvePageComponent(
			`./pages/${pageName}.tsx`,
			import.meta.glob('./pages/**/*.tsx'),
		)
	},

	setup({ el, App, props }) {
		// If there is no server-rendered markup, do a client render to avoid hydration mismatch
		const hasSSRContent = el.hasChildNodes()
		const app = (
			<>
				<App {...props} />
				<Toaster />
			</>
		)
		if (hasSSRContent) {
			hydrateRoot(el, app)
		} else {
			createRoot(el).render(app)
		}
	},
});


