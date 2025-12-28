import type { CustomFieldDefinition } from '../types/custom_field.js'

export type SiteField = CustomFieldDefinition

// Code-first site custom fields. Edit as needed.
const siteFields: SiteField[] = [
  { slug: 'tagline', label: 'Site Tagline', type: 'text', category: 'General' },
  {
    slug: 'announcement',
    label: 'Site Announcement',
    type: 'richtext',
    category: 'General',
    description: 'Displays a banner at the top of every page if content is provided.',
  },
  { slug: 'contact_email', label: 'Contact Email', type: 'text', category: 'Contact' },
  { slug: 'footer_note', label: 'Footer Note', type: 'textarea', category: 'General' },
  { slug: 'show_search', label: 'Enable Search', type: 'boolean', category: 'General' },
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
  {
    slug: 'cookie_consent_enabled',
    label: 'Enable Cookie Consent',
    type: 'boolean',
    category: 'Privacy',
    description: 'Display a cookie consent banner to new visitors.',
  },
  {
    slug: 'cookie_consent_message',
    label: 'Consent Message',
    type: 'richtext',
    category: 'Privacy',
    description: 'The message explaining cookie usage.',
  },
  {
    slug: 'cookie_consent_button_text',
    label: 'Accept Button Text',
    type: 'text',
    category: 'Privacy',
    description: 'Text for the acceptance button.',
  },
]

export default siteFields
