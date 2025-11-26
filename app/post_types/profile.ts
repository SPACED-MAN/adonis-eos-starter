export default {
  hideCoreFields: ['title'],
  hierarchyEnabled: false,
  fields: [
    { slug: 'first_name', label: 'First name', type: 'text' },
    { slug: 'last_name', label: 'Last name', type: 'text' },
    { slug: 'profile_image', label: 'Profile image', type: 'media', config: { category: 'Profile image', preferredVariant: 'thumb' } },
    { slug: 'bio', label: 'Bio', type: 'textarea' },
  ],
  template: { name: 'profile-default', description: 'Default Profile Template' },
  urlPatterns: [],
} as const


