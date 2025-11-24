import React from 'react'

// Eagerly import all post-type components in this folder for SSR compatibility.
// Pages (full post renderers) - exclude teaser files
const pageModules = import.meta.glob('./*.tsx', { eager: true }) as Record<string, any>
// Teasers (list cards etc.)
const teaserModules = import.meta.glob('./*-teaser*.tsx', { eager: true }) as Record<string, any>

// Helper to normalize keys
function keyOf(filePath: string): string {
	return filePath.replace(/^\.\/+/, '')
}

export function getPostTypePageComponent(type: string): React.ComponentType<any> {
	const safeType = String(type || '').trim() || 'post'
	// Try exact type file e.g., blog.tsx
	const specificKey = `${safeType}.tsx`
	for (const k of Object.keys(pageModules)) {
		if (keyOf(k) === specificKey) {
			return pageModules[k].default as React.ComponentType<any>
		}
	}
	// Fallback to default post.tsx
	const fallbackKey = 'post.tsx'
	if (Object.prototype.hasOwnProperty.call(pageModules, `./${fallbackKey}`)) {
		return pageModules[`./${fallbackKey}`].default as React.ComponentType<any>
	}
	throw new Error('Default post page renderer (post.tsx) not found in post-types.')
}

export function getTeaserComponent(type: string, theme?: string): React.ComponentType<any> {
	const safeType = String(type || '').trim() || 'post'
	const safeTheme = String(theme || '').trim()
	const candidates: string[] = []
	// Most specific: type-teaser-theme.tsx
	if (safeTheme) candidates.push(`${safeType}-teaser-${safeTheme}.tsx`)
	// Type default teaser: type-teaser.tsx
	candidates.push(`${safeType}-teaser.tsx`)
	// Fallbacks on base "post"
	if (safeTheme) candidates.push(`post-teaser-${safeTheme}.tsx`)
	candidates.push('post-teaser.tsx')

	for (const candidate of candidates) {
		for (const k of Object.keys(teaserModules)) {
			if (keyOf(k) === candidate) {
				return teaserModules[k].default as React.ComponentType<any>
			}
		}
	}
	throw new Error('Default teaser renderer (post-teaser.tsx) not found in post-types.')
}

export type { React }


