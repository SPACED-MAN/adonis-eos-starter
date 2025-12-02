export type SiteField =
	| { slug: string; label: string; type: 'text' | 'url' }
	| { slug: string; label: string; type: 'textarea' }
	| { slug: string; label: string; type: 'boolean' }
	| { slug: string; label: string; type: 'media' }
	| { slug: string; label: string; type: 'form-reference' }

// Code-first site custom fields. Edit as needed.
const siteFields: SiteField[] = [
	{ slug: 'tagline', label: 'Site Tagline', type: 'text' },
	{ slug: 'contact_email', label: 'Contact Email', type: 'text' },
	{ slug: 'footer_note', label: 'Footer Note', type: 'textarea' },
	{ slug: 'show_search', label: 'Show Search', type: 'boolean' },
	{ slug: 'default_form_slug', label: 'Default Form', type: 'form-reference' },
	// Protected content access (optional; falls back to env if unset)
	{ slug: 'protected_access_username', label: 'Protected Username', type: 'text' },
	{ slug: 'protected_access_password', label: 'Protected Password', type: 'text' },
]

export default siteFields
