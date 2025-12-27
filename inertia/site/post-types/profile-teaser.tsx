import { MediaRenderer } from '../../components/MediaRenderer'
import { type MediaObject } from '../../utils/useMediaUrl'

interface ProfileTeaserProps {
  id: string
  name: string
  role?: string | null
  bio?: string | null
  image?: MediaObject | string | null
  url: string
}

export default function ProfileTeaser({ name, role, bio, image, url }: ProfileTeaserProps) {
  return (
    <article className="items-center bg-backdrop-medium shadow sm:flex border border-line-low">
      {image && (
        <a
          href={url}
          className="p-1 sm:shrink-0 block w-full sm:w-44 h-44 sm:h-full max-h-60 overflow-hidden"
        >
          <MediaRenderer image={image} variant="thumb" loading="lazy" decoding="async" />
        </a>
      )}
      <div className="p-5">
        <h3 className="py-1 text-xl font-bold tracking-tight text-neutral-high">
          <a href={url}>{name}</a>
        </h3>
        {role && <span className="text-neutral-medium block mt-1">{role}</span>}
        {bio && <p className="mt-3 mb-4 font-light text-neutral-high line-clamp-3">{bio}</p>}
      </div>
    </article>
  )
}
