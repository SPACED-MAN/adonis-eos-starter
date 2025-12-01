import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class FeaturesListModule extends BaseModule {
	getConfig(): ModuleConfig {
		return {
			type: 'features-list',
			name: 'Features List',
			description:
				'Grid of up to 24 features with an icon, short title, and supporting body copy, using neutral project tokens.',
			icon: 'list-ul',
			allowedScopes: ['local', 'global'],
			lockable: true,
			propsSchema: {
				title: {
					type: 'string',
					required: true,
					description: 'Section heading shown above the features grid',
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
					description: 'List of feature items (up to 24)',
					maxItems: 24,
					items: {
						type: 'object',
						properties: {
							icon: {
								type: 'string',
								required: false,
								description:
									'Font Awesome icon classes (e.g., fa-solid fa-briefcase). Rendered inside a circular badge.',
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
								description: 'Short feature description',
								translatable: true,
							},
						},
					},
				},
			},
			defaultProps: {
				title: 'Designed for business teams like yours',
				subtitle:
					'We focus on markets where technology, innovation, and capital can unlock long-term value and drive economic growth.',
				features: [
					{
						icon: 'fa-solid fa-bullhorn',
						title: 'Marketing',
						body: 'Plan it, create it, launch it. Collaborate seamlessly across the organization and hit your marketing goals every month.',
					},
					{
						icon: 'fa-solid fa-scale-balanced',
						title: 'Legal',
						body: 'Protect your organization and stay compliant with structured workflows and granular permissions.',
					},
					{
						icon: 'fa-solid fa-gear',
						title: 'Business Automation',
						body: 'Automate handoffs, notifications, and approvals so your team can focus on high‑value work.',
					},
					{
						icon: 'fa-solid fa-coins',
						title: 'Finance',
						body: 'Audit‑ready workflows for close, forecasting, and quarterly budgeting.',
					},
					{
						icon: 'fa-solid fa-pen-ruler',
						title: 'Enterprise Design',
						body: 'Craft consistent experiences for both marketing and product with shared systems.',
					},
					{
						icon: 'fa-solid fa-diagram-project',
						title: 'Operations',
						body: 'Keep the business running smoothly with repeatable, measurable processes.',
					},
				],
				backgroundColor: 'bg-backdrop-low',
			},
			allowedPostTypes: [],
		}
	}
}


