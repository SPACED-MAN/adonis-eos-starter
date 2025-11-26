export function humanizeSlug(input: string | null | undefined): string {
	if (!input) return ''
	return String(input)
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
}


