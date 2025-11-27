export const CUSTOM_FIELD_TYPES = [
	'text',
	'textarea',
	'number',
	'select',
	'multiselect',
	'media',
	'date',
	'url',
] as const

export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number]

export type PostTypeField = {
	slug: string
	label: string
	type: CustomFieldType
	translatable?: boolean
	config?: Record<string, any>
}



