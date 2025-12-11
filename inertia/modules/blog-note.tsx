import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

type Props = {
  note?: string
  className?: string
  __moduleId?: string
}

export default function BlogNote({ note: initialNote = '', className, __moduleId }: Props) {
  const note = useInlineValue(__moduleId, 'note', initialNote)
  return (
    <section className={className} data-module="blog-note">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-neutral-high" data-inline-path="note">
            {note}
          </p>
        </div>
      </div>
    </section>
  )
}


