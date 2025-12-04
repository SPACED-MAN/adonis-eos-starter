import type { FormConfig } from '#types/form_types'

const contactForm: FormConfig = {
  slug: 'contact',
  title: 'Contact us',
  description: 'Use this form to reach out to our team.',
  fields: [
    { slug: 'name', label: 'Name', type: 'text', required: true },
    { slug: 'email', label: 'Email', type: 'email', required: true },
    { slug: 'company', label: 'Company', type: 'text', required: false },
    { slug: 'message', label: 'Message', type: 'textarea', required: true },
  ],
}

export default contactForm
