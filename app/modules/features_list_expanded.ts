import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class FeaturesListExpandedModule extends BaseModule {
	getConfig(): ModuleConfig {
		return {
			type: 'features-list-expanded',
			name: 'Features List (Expanded)',
			description:
				'Expanded, timeline-style feature list with alternating layout and an optional call-to-action button.',
			icon: 'list-check',
			allowedScopes: ['local', 'global'],
			lockable: true,
			propsSchema: {
				title: {
					type: 'string',
					required: true,
					description: 'Section heading shown above the expanded feature list',
					translatable: true,
				},
				subtitle: {
					type: 'textarea',
					required: false,
					description: 'Short paragraph explaining the section',
					translatable: true,
				},
				features: {
					type: 'array',
					required: true,
					description: 'List of feature items (up to 12)',
					maxItems: 12,
					items: {
						type: 'object',
						properties: {
							icon: {
								type: 'string',
								required: false,
								description:
									'Font Awesome icon name (e.g., bolt, layers, users) resolved via Fort Awesome React implementation.',
							},
							title: {
								type: 'string',
								required: true,
								description: 'Short feature title',
								translatable: true,
							},
							body: {
								type: 'textarea',
								required: true,
								description: 'Longer description for this feature item',
								translatable: true,
							},
						},
					},
				},
				cta: {
					type: 'object',
					label: 'Section CTA',
					description: 'Optional call-to-action button rendered below the feature list',
					fields: [
						{
							name: 'label',
							type: 'string',
							label: 'Label',
							translatable: true,
						},
						{
							name: 'url',
							type: 'link',
							label: 'Destination',
						},
						{
							name: 'style',
							type: 'select',
							label: 'Style',
							options: [
								{ label: 'Primary', value: 'primary' },
								{ label: 'Secondary', value: 'secondary' },
								{ label: 'Outline', value: 'outline' },
							],
							default: 'primary',
						},
					],
				},
			},
			defaultProps: {
				title: 'Built for growing teams and ambitious roadmaps',
				subtitle:
					'Use this section to highlight major phases, advantages, or pillars of your product or service with more detailed copy.',
				features: [
					{
						icon: 'rocket',
						title: 'Launch faster',
						body: 'Streamline launch checklists, approvals, and handoffs so cross-functional teams can ship campaigns in days, not weeks.',
					},
					{
						icon: 'layer-group',
						title: 'Standardize playbooks',
						body: 'Codify your best practices into repeatable workflows so every team can follow the same proven path to results.',
					},
					{
						icon: 'users',
						title: 'Align stakeholders',
						body: 'Give marketing, sales, and operations a shared source of truth so everyone stays aligned on what ships next.',
					},
				],
				cta: {
					label: 'Explore all features',
					url: { kind: 'url', url: '#', target: '_self' },
					style: 'primary',
				},
				backgroundColor: 'bg-backdrop-low',
			},
			allowedPostTypes: [],
		}
	}
}


