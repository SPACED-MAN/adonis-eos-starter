/**
 * Sync logic for Profile post types.
 * Helps keep the hidden 'title' field in sync with 'first_name' and 'last_name' custom fields.
 */

export function generateProfileTitleFromCustomFields(
  customFields: Array<{ slug: string; value: any }> | Record<string, any>
): string | null {
  let firstName = ''
  let lastName = ''

  if (Array.isArray(customFields)) {
    firstName = String(customFields.find((f) => f.slug === 'first_name')?.value || '').trim()
    lastName = String(customFields.find((f) => f.slug === 'last_name')?.value || '').trim()
  } else {
    firstName = String(customFields.first_name || '').trim()
    lastName = String(customFields.last_name || '').trim()
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  if (fullName) {
    return `${fullName}'s Profile`
  }

  return null
}


