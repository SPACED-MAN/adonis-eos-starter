export function formatDateTime(isoOrDate: string | Date): string {
	const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
	return d.toLocaleString()
}


