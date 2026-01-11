import { createContext, useContext } from 'react'

export interface ModuleContextType {
  isFirst: boolean
  index: number
}

export const ModuleContext = createContext<ModuleContextType>({
  isFirst: false,
  index: -1,
})

export const useModuleContext = () => useContext(ModuleContext)

