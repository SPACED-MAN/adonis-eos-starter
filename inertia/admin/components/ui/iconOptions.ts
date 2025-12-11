import {
	faArrowRight,
	faBullhorn,
	faScaleBalanced,
	faGear,
	faCoins,
	faPenRuler,
	faDiagramProject,
	faCircleQuestion,
	faQuoteLeft,
	faCheck,
	faChevronDown,
	faCube,
	faLanguage,
	faUsers,
	faCodeBranch,
	faPalette,
	faBolt,
	faRocket,
	faLayerGroup,
	faMoon,
	faSun,
	faPencil,
} from '@fortawesome/free-solid-svg-icons'

export const iconOptions = [
	{ name: 'arrow-right', label: 'Arrow Right', icon: faArrowRight },
	{ name: 'bullhorn', label: 'Bullhorn', icon: faBullhorn },
	{ name: 'scale-balanced', label: 'Scale Balanced', icon: faScaleBalanced },
	{ name: 'gear', label: 'Gear', icon: faGear },
	{ name: 'coins', label: 'Coins', icon: faCoins },
	{ name: 'pen-ruler', label: 'Pen Ruler', icon: faPenRuler },
	{ name: 'diagram-project', label: 'Diagram Project', icon: faDiagramProject },
	{ name: 'circle-question', label: 'Circle Question', icon: faCircleQuestion },
	{ name: 'quote-left', label: 'Quote Left', icon: faQuoteLeft },
	{ name: 'check', label: 'Check', icon: faCheck },
	{ name: 'chevron-down', label: 'Chevron Down', icon: faChevronDown },
	{ name: 'cube', label: 'Cube', icon: faCube },
	{ name: 'language', label: 'Language', icon: faLanguage },
	{ name: 'users', label: 'Users', icon: faUsers },
	{ name: 'code-branch', label: 'Code Branch', icon: faCodeBranch },
	{ name: 'palette', label: 'Palette', icon: faPalette },
	{ name: 'bolt', label: 'Bolt', icon: faBolt },
	{ name: 'rocket', label: 'Rocket', icon: faRocket },
	{ name: 'layer-group', label: 'Layer Group', icon: faLayerGroup },
	{ name: 'moon', label: 'Moon', icon: faMoon },
	{ name: 'sun', label: 'Sun', icon: faSun },
	{ name: 'pencil', label: 'Pencil', icon: faPencil },
] as const

export const iconMap: Record<string, any> = iconOptions.reduce((acc, item) => {
	acc[item.name] = item.icon
	return acc
}, {} as Record<string, any>)


