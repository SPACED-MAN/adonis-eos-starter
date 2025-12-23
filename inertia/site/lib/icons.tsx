import { library } from '@fortawesome/fontawesome-svg-core'
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
  faGripVertical,
  faLanguage,
  faUsers,
  faCodeBranch,
  faPalette,
  faBolt,
  faRocket,
  faLayerGroup,
  faMoon,
  faSun,
  faWrench,
  faPencil,
  faGlobe,
  faHighlighter,
  faLink,
  faList,
  faCheckCircle,
  faCalendar,
  faArrowUp,
  faArrowDown,
  faTrash,
  faPlus,
  faSave,
  faCircleExclamation,
  faEnvelope,
  faShareNodes,
} from '@fortawesome/free-solid-svg-icons'
import {
  faFacebookF,
  faXTwitter,
  faLinkedinIn,
  faInstagram,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

// Register a curated set of icons we actually use in the site so string names can resolve.
library.add(
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
  faGripVertical,
  faLanguage,
  faUsers,
  faCodeBranch,
  faPalette,
  faBolt,
  faRocket,
  faLayerGroup,
  faMoon,
  faSun,
  faWrench,
  faPencil,
  faGlobe,
  faHighlighter,
  faLink,
  faList,
  faCheckCircle,
  faCalendar,
  faArrowUp,
  faArrowDown,
  faTrash,
  faPlus,
  faSave,
  faCircleExclamation,
  faEnvelope,
  faShareNodes,
  faFacebookF,
  faXTwitter,
  faLinkedinIn,
  faInstagram,
  faYoutube
)

export { FontAwesomeIcon }

/**
 * Helper to resolve an icon name to a FontAwesome icon prop.
 * Handles both solid and brand icons registered in the library.
 */
export function getIconProp(name: string): any {
  if (!name) return null

  // Known brand icons in our library
  const brands = ['facebook-f', 'x-twitter', 'linkedin-in', 'instagram', 'youtube']
  if (brands.includes(name)) {
    return ['fab', name]
  }

  // Default to solid
  return name
}
