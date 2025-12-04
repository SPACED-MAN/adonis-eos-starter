export default {
  hideCoreFields: ['title'],
  hierarchyEnabled: false,
  fields: [
    { slug: 'first_name', label: 'First name', type: 'text' },
    { slug: 'last_name', label: 'Last name', type: 'text' },
    { slug: 'bio', label: 'Bio', type: 'textarea' },
  ],
  // Use Featured Image as the profile image, with a friendly label
  featuredImage: {
    enabled: true,
    label: 'Profile image',
  },
  template: { name: 'profile-default', description: 'Default Profile Template' },
  urlPatterns: [],
} as const
