import FormModule from './form'

interface ProseWithFormProps {
  title: string
  body?: string | null
  formSlug: string
  layout?: 'form-right' | 'form-left'
}

export default function ProseWithForm({
  title,
  body,
  formSlug,
  layout = 'form-right',
  backgroundColor = 'bg-backdrop-low',
}: ProseWithFormProps) {
  const isFormRight = layout === 'form-right'

  const proseBlock = (
    <div className="space-y-4">
      <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high">
        {title}
      </h2>
      {body && <p className="text-base md:text-lg font-normal text-neutral-medium">{body}</p>}
    </div>
  )

  const formBlock = (
    <div className="mt-6 md:mt-0">
      <FormModule title={null} subtitle={null} formSlug={formSlug} />
    </div>
  )

  return (
    <section className={`${backgroundColor} py-12 sm:py-16`} data-module="prose-with-form">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:grid md:grid-cols-2 md:gap-8 xl:gap-16 items-start">
          {isFormRight ? (
            <>
              {proseBlock}
              {formBlock}
            </>
          ) : (
            <>
              {formBlock}
              {proseBlock}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
