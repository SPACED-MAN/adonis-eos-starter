import type { PostTypeConfig } from '../types/post_type.ts'

const profilePostType: PostTypeConfig = {
  type: 'profile',
  label: 'Profile',
  pluralLabel: 'Profiles',
  hideCoreFields: ['title'],
  hierarchyEnabled: false,
  fields: [
    { slug: 'first_name', label: 'First name', type: 'text' },
    { slug: 'last_name', label: 'Last name', type: 'text' },
    { slug: 'bio', label: 'Bio', type: 'textarea' },
  ],
  // Use Featured Media as the profile image, with a friendly label
  featuredMedia: {
    enabled: true,
    label: 'Profile image',
  },
  moduleGroup: { name: 'profile-default', description: 'Default Profile Module Group' },
  // Enable modules for profiles
  modulesEnabled: true,
  // URL patterns
  urlPatterns: [{ locale: 'en', pattern: '/profile/{slug}', isDefault: true }],
}

export default profilePostType
