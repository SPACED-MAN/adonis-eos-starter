type Props = {
  note?: string
  className?: string
}

export default function BlogNote({ note = '', className }: Props) {
  return (
    <section className={className} data-module="blog-note">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-neutral-high">{note}</p>
        </div>
      </div>
    </section>
  )
}


