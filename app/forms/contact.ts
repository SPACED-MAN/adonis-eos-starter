import type { FormConfig } from '#types/form_types'

const contactForm: FormConfig = {
  slug: 'contact',
  title: 'Contact us',
  description: 'Use this form to reach out to our team.',
  fields: [
    { slug: 'name', label: 'Name', type: 'text', required: true },
    { slug: 'email', label: 'Email', type: 'text', required: true },
    { slug: 'company', label: 'Company', type: 'text', required: false },
    { slug: 'message', label: 'Message', type: 'textarea', required: true },
  ],
  successMessage: 'Thank you for your message! We will get back to you shortly.',
}

export default contactForm
