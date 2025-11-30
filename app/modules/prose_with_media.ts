import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class ProseWithMediaModule extends BaseModule {
	getRenderingMode() {
		return 'react' as const
	}

	getConfig(): ModuleConfig {
		return {
			type: 'prose-with-media',
			name: 'Prose with Media Content',
			description: 'Two-column layout pairing prose-style content with a supporting media block.',
			icon: 'layout-text-media',
			allowedScopes: ['local', 'global'],
			lockable: true,
			propsSchema: {
				title: {
					type: 'text',
					label: 'Title',
					required: true,
					description: 'Main heading text',
					translatable: true,
				},
				body: {
					type: 'textarea',
					label: 'Body',
					required: false,
					description: 'Supporting prose-style paragraph below the title',
					translatable: true,
				},
				image: {
					type: 'media',
					label: 'Media',
					accept: 'image/*',
					storeAs: 'id',
					description: 'Image or illustration shown beside the prose (stored as media ID).',
				},
				imageAlt: {
					type: 'text',
					label: 'Image Alt Text',
					required: false,
					description: 'Accessible alt text for the image',
					translatable: true,
				},
				imagePosition: {
					type: 'select',
					label: 'Image Position',
					description: 'Which side the media appears on for larger screens',
					options: [
						{ label: 'Left', value: 'left' },
						{ label: 'Right', value: 'right' },
					],
					default: 'left',
				},
				primaryCta: {
					type: 'object',
					label: 'Primary CTA',
					description: 'Main call-to-action button beneath the prose',
					fields: [
						{
							name: 'label',
							type: 'text',
							label: 'Label',
							translatable: true,
						},
						{
							name: 'url',
							type: 'url',
							label: 'URL',
						},
						{
							name: 'target',
							type: 'select',
							label: 'Target',
							options: [
								{ label: 'Same tab', value: '_self' },
								{ label: 'New tab', value: '_blank' },
							],
							default: '_self',
						},
					],
				},
				backgroundColor: {
					type: 'text',
					label: 'Background Classes',
					default: 'bg-backdrop-low',
					description: 'Tailwind background classes (use project tokens like bg-backdrop-low).',
				},
			},
			defaultProps: {
				title: "Let's create more tools and ideas that bring us together.",
				body: 'This layout pairs narrative content with a focused visual, ideal for feature callouts, product explainers, and lightweight storytelling.',
				image: null,
				imageAlt: 'Dashboard illustration',
				imagePosition: 'left',
				primaryCta: {
					label: 'Get started',
					url: '#',
					target: '_self',
				},
				backgroundColor: 'bg-backdrop-low',
			},
			allowedPostTypes: [],
		}
	}
}


