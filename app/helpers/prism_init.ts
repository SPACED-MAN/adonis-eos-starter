import Prism from 'prismjs'

// Prism components expect a global Prism object
if (typeof global !== 'undefined') {
  ;(global as any).Prism = (global as any).Prism || Prism
}

export default Prism

