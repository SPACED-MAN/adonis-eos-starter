import { FontAwesomeIcon } from '../lib/icons'
import { MediaRenderer } from '../../components/MediaRenderer'
import { type MediaObject } from '../../utils/useMediaUrl'

interface CompanyTeaserProps {
  id: string
  title: string
  image?: MediaObject | string | null
  url: string
  customFields?: Record<string, any>
}

export default function CompanyTeaser({ title, image, url, customFields }: CompanyTeaserProps) {
  const address = customFields?.address
  const phone = customFields?.phone

  return (
    <div className="flex flex-col items-center text-center p-4 rounded-lg shadow-sm border border-line-low/10 hover:shadow-md transition-shadow">
      <div className="h-16 w-full flex items-center justify-center mb-4 overflow-hidden">
        {image ? (
          <MediaRenderer
            image={image}
            variant="thumb"
            className="h-full w-auto object-contain hover:opacity-90 transition"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="text-lg font-bold text-neutral-high">{title}</span>
        )}
      </div>

      <div className="space-y-2 w-full">
        <h3 className="text-sm font-semibold text-neutral-high line-clamp-1">{title}</h3>

        {(address || phone) && (
          <div className="text-[10px] text-neutral-medium space-y-1 mt-2 border-t border-neutral-low/5 pt-2">
            {address && (
              <div className="flex items-start justify-center gap-1.5 px-2">
                <FontAwesomeIcon icon="location-dot" className="w-2.5 h-2.5 mt-0.5 flex-shrink-0 text-neutral-low" />
                <span className="line-clamp-2">{address}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center justify-center gap-1.5 px-2">
                <FontAwesomeIcon icon="phone" className="w-2.5 h-2.5 flex-shrink-0 text-neutral-low" />
                <span>{phone}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
