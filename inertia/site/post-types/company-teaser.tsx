interface CompanyTeaserProps {
  id: string
  title: string
  imageUrl?: string | null
  url: string
}

export default function CompanyTeaser({ title, imageUrl, url }: CompanyTeaserProps) {
  return (
    <div className="flex items-center justify-center">
      <a href={url} className="flex justify-center items-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-30 w-auto object-contain hover:opacity-90 transition"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="text-sm font-medium text-neutral-high">{title}</span>
        )}
      </a>
    </div>
  )
}
