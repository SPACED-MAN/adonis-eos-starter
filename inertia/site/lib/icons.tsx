import { library, config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
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
  faClone,
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
  faLink,
  faList,
  faCheckCircle,
  faCalendar,
  faEnvelope,
  faShareNodes,
  faLocationDot,
  faPhone,
  faBrain,
  faWandMagicSparkles,
  faGauge,
  faBarsProgress,
  faTurnUp,
  faSearch,
  faCircleInfo,
  faDownload,
  faXmark,
  faPuzzlePiece,
  faTags,
  faDatabase,
  faClock,
  faMicrochip,
  faChevronUp,
  faTerminal,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import {
  faFacebookF,
  faXTwitter,
  faLinkedinIn,
  faInstagram,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

// Prevent Font Awesome from adding its CSS since we did it manually above:
config.autoAddCss = false

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
  faClone,
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
  faLink,
  faList,
  faCheckCircle,
  faCalendar,
  faEnvelope,
  faShareNodes,
  faLocationDot,
  faPhone,
  faBrain,
  faWandMagicSparkles,
  faFacebookF,
  faXTwitter,
  faLinkedinIn,
  faInstagram,
  faYoutube,
  faGauge,
  faBarsProgress,
  faTurnUp,
  faSearch,
  faCircleInfo,
  faDownload,
  faXmark,
  faPuzzlePiece,
  faTags,
  faDatabase,
  faClock,
  faMicrochip,
  faChevronUp,
  faTerminal,
  faChevronLeft,
  faChevronRight
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
