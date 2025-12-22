import type { FormConfig } from '#types/form_types'

const contactForm: FormConfig = {
  slug: 'lorem',
  title: 'Lorem Form',
  description: 'Use this form to reach out to our team.',
  fields: [
    { slug: 'name', label: 'Your Name', type: 'text', required: true },
    { slug: 'email', label: 'Email', type: 'text', required: true },
    { slug: 'company', label: 'Company', type: 'text', required: false },
    { slug: 'message', label: 'Message', type: 'textarea', required: true },
    {
      slug: 'tags',
      type: 'multiselect',
      label: 'Tags',
      options: [
        { label: 'Alpha', value: 'alpha' },
        { label: 'Beta', value: 'beta' },
        { label: 'Gamma', value: 'gamma' },
      ],
    },
  ],
  successMessage: 'Thank you for your message! We will get back to you shortly.',
}

export default contactForm
