import React from 'react'
import { FormLabel } from './field'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'

interface LabelWithDescriptionProps {
  label: string
  description?: string
  hideLabel?: boolean
}

export const LabelWithDescription = ({
  label,
  description,
  hideLabel,
}: LabelWithDescriptionProps) => {
  if (hideLabel) return null
  return (
    <div className="flex items-center gap-1.5">
      <FormLabel className="mt-0 mb-0.5">{label}</FormLabel>
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-neutral-low hover:text-neutral-high transition-colors"
            >
              <FontAwesomeIcon icon={faCircleInfo} size="xs" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs font-normal normal-case tracking-normal">
            {description}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
