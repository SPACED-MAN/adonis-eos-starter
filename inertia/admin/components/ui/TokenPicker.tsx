import React, { useMemo } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { TokenService, type TokenDefinition } from '../../../lib/tokens'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faPuzzlePiece, faTags } from '@fortawesome/free-solid-svg-icons'

interface TokenPickerProps {
  onSelect: (tokenName: string) => void
  customFields?: Array<{ slug: string; label: string }>
  trigger?: React.ReactNode
}

export function TokenPicker({ onSelect, customFields, trigger }: TokenPickerProps) {
  const tokens = useMemo(() => TokenService.getAvailableTokens(customFields), [customFields])

  const groupedTokens = useMemo(() => {
    return tokens.reduce(
      (acc, token) => {
        if (!acc[token.category]) acc[token.category] = []
        acc[token.category].push(token)
        return acc
      },
      {} as Record<string, TokenDefinition[]>
    )
  }, [tokens])

  const categoryIcons = {
    post: faTags,
    system: faCube,
    custom: faPuzzlePiece,
    settings: faCube,
    author: faCube, // Using faCube for author for now, or I could use faUser if available
  }

  const categoryLabels = {
    post: 'Post Data',
    system: 'System',
    custom: 'Custom Fields',
    settings: 'Site Settings',
    author: 'Author Info',
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {trigger || (
              <button
                type="button"
                className="flex items-center justify-center h-6.5 w-6.5 rounded-md border border-line-medium bg-backdrop-low text-neutral-medium hover:bg-backdrop-medium hover:text-neutral-high transition-colors"
              >
                <span className="pr-0.5 text-xs font-mono tracking-[-.15em] whitespace-nowrap">
                  {'{ }'}
                </span>
              </button>
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Insert Variable</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-0 shadow-xl border-line-low bg-backdrop-high" align="end">
        <div className="flex flex-col max-h-80">
          <div className="px-3 py-2 border-b border-line-low bg-backdrop-medium">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-low">
              Insert Variable
            </span>
          </div>
          <div className="overflow-y-auto p-1 space-y-4">
            {(Object.entries(groupedTokens) as [string, TokenDefinition[]][]).map(
              ([category, items]) => (
                <div key={category} className="space-y-1">
                  <div className="px-2 py-1 flex items-center gap-2 text-[10px] font-medium text-neutral-low">
                    <FontAwesomeIcon
                      icon={(categoryIcons as any)[category] || faCube}
                      className="w-2.5 h-2.5"
                    />
                    {(categoryLabels as any)[category] || category}
                  </div>
                  {items.map((token) => (
                    <button
                      key={token.name}
                      type="button"
                      onClick={() => onSelect(token.name)}
                      className="w-full flex flex-col items-start px-2 py-1.5 rounded-sm hover:bg-standout-low text-left transition-colors"
                    >
                      <span className="text-xs font-mono font-medium text-neutral-high">
                        {`{${token.name}}`}
                      </span>
                      {token.label && (
                        <span className="text-[10px] text-neutral-low truncate w-full">
                          {token.label}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
          {tokens.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-neutral-low">
              No tokens available.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default TokenPicker
