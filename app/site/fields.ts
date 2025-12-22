import type { CustomFieldDefinition } from '../types/custom_field.js'

export type SiteField = CustomFieldDefinition

// Code-first site custom fields. Edit as needed.
const siteFields: SiteField[] = [
  { slug: 'tagline', label: 'Site Tagline', type: 'text', category: 'General' },
  { slug: 'contact_email', label: 'Contact Email', type: 'text', category: 'Contact' },
  { slug: 'footer_note', label: 'Footer Note', type: 'textarea', category: 'General' },
  { slug: 'show_search', label: 'Show Search', type: 'boolean', category: 'General' },
  { slug: 'default_form_slug', label: 'Default Form', type: 'form-reference', category: 'General' },
  // Protected content access (optional; falls back to env if unset)
  {
    slug: 'protected_access_username',
    label: 'Protected Username',
    type: 'text',
    category: 'Security',
  },
  {
    slug: 'protected_access_password',
    label: 'Protected Password',
    type: 'text',
    category: 'Security',
  },
]

export default siteFields
