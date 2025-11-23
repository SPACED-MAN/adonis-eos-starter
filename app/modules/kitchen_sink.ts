import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class KitchenSinkModule extends BaseModule {
	getRenderingMode() {
		return 'react' as const
	}

	getConfig(): ModuleConfig {
		return {
			type: 'kitchen-sink',
			name: 'Kitchen Sink',
			description: 'A demo module showcasing all supported field types (text, textarea, number, select, multiselect, boolean, date, url, media, object, repeater, richtext).',
			icon: 'flask',
			allowedScopes: ['local', 'global', 'static'],
			lockable: false,
			propsSchema: {
				postRefs: {
					type: 'post-reference',
					label: 'Post References',
					postTypes: ['blog'], // limit to specific types; remove or change as needed
					allowMultiple: true,
				},
				title: { type: 'text', label: 'Title', required: true, placeholder: 'Enter title' },
				description: { type: 'textarea', label: 'Description' },
				count: { type: 'number', label: 'Count' },
				category: {
					type: 'select',
					label: 'Category',
					options: [
						{ label: 'General', value: 'general' },
						{ label: 'News', value: 'news' },
						{ label: 'Updates', value: 'updates' },
					],
				},
				tags: {
					type: 'multiselect',
					label: 'Tags',
					options: [
						{ label: 'Alpha', value: 'alpha' },
						{ label: 'Beta', value: 'beta' },
						{ label: 'Gamma', value: 'gamma' },
					],
				},
				featured: { type: 'boolean', label: 'Featured' },
				publishDate: { type: 'date', label: 'Publish Date' },
				linkUrl: { type: 'url', label: 'Link URL', placeholder: 'https://example.com' },
				media: { type: 'media', label: 'Media URL or ID' },
				progress: {
					type: 'slider',
					label: 'Progress',
					min: 0,
					max: 100,
					step: 5,
					unit: '%',
				},
				metadata: {
					type: 'object',
					label: 'Metadata',
					fields: [
						{ name: 'author', type: 'text', label: 'Author' },
						{ name: 'readingTime', type: 'number', label: 'Reading Time (min)' },
						{ name: 'attributionRequired', type: 'boolean', label: 'Attribution Required' },
					],
				},
				items: {
					type: 'repeater',
					label: 'Items',
					item: {
						name: 'item',
						type: 'object',
						fields: [
							{ name: 'label', type: 'text', label: 'Label' },
							{ name: 'value', type: 'text', label: 'Value' },
							{ name: 'highlight', type: 'boolean', label: 'Highlight' },
						],
					},
				},
				content: {
					type: 'richtext',
					label: 'Rich Text Content',
					required: false,
				},
			},
			defaultProps: {
				postRefs: [],
				title: 'Kitchen Sink Demo',
				description: 'This module demonstrates all supported field types.',
				count: 3,
				category: 'general',
				tags: ['alpha', 'beta'],
				featured: true,
				publishDate: new Date().toISOString().slice(0, 10),
				linkUrl: 'https://example.com',
				media: 'https://via.placeholder.com/800x400.png?text=Demo',
				progress: 50,
				metadata: {
					author: 'Ada Lovelace',
					readingTime: 5,
					attributionRequired: false,
				},
				items: [
					{ label: 'First', value: 'One', highlight: true },
					{ label: 'Second', value: 'Two', highlight: false },
				],
				content: {
					root: {
						type: 'root',
						children: [
							{
								type: 'paragraph',
								children: [{ type: 'text', text: 'This is a rich text field powered by Lexical.' }],
							},
							{
								type: 'paragraph',
								children: [{ type: 'text', text: 'Use the module editor to try all field types.' }],
							},
						],
					},
				},
			},
			allowedPostTypes: [],
		}
	}
}


