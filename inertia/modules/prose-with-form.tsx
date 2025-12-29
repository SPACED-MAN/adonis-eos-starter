import { motion } from 'framer-motion'
import FormModule from './form'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

import { renderLexicalToHtml } from '../utils/lexical'

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

interface ProseWithFormProps {
  heading: string
  content?: LexicalJSON | string | null
  formSlug: string
  layout?: 'form-right' | 'form-left'
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

export default function ProseWithForm({
  heading,
  content: initialContent,
  formSlug,
  layout = 'form-right',
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: ProseWithFormProps) {
  const headingValue = useInlineValue(__moduleId, 'heading', heading)
  const contentValue = useInlineValue(__moduleId, 'content', initialContent)
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high' || bg === 'bg-backdrop-high' || bg === 'bg-standout-medium'
  const textColor = isDarkBg ? 'text-on-high' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-high/80' : 'text-neutral-medium'

  const isFormRight = layout === 'form-right'

  const contentHtml = renderLexicalToHtml(contentValue)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.25,
      },
    },
  }

  const proseVariants = {
    hidden: { opacity: 0, x: isFormRight ? -30 : 30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const formVariants = {
    hidden: { opacity: 0, x: isFormRight ? 30 : -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const proseBlock = (
    <div className="space-y-4">
      <h2
        className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor}`}
        data-inline-path="heading"
      >
        {headingValue}
      </h2>
      {contentValue && (
        <div
          className={`prose prose-sm md:prose-base ${isDarkBg ? 'prose-invert' : ''} ${subtextColor} max-w-none`}
          suppressHydrationWarning
          data-inline-type="richtext"
          data-inline-path="content"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}
    </div>
  )

  const formBlock = (
    <div className="mt-6 md:mt-0">
      <FormModule
        title={null}
        subtitle={null}
        formSlug={formSlug}
        backgroundColor="bg-transparent"
      />
    </div>
  )

  const content = (
    <div className="md:grid md:grid-cols-2 md:gap-8 xl:gap-16 items-start">
      {isFormRight ? (
        <>
          {_useReact ? (
            <>
              <motion.div variants={proseVariants}>{proseBlock}</motion.div>
              <motion.div variants={formVariants}>{formBlock}</motion.div>
            </>
          ) : (
            <>
              {proseBlock}
              {formBlock}
            </>
          )}
        </>
      ) : (
        <>
          {_useReact ? (
            <>
              <motion.div variants={formVariants}>{formBlock}</motion.div>
              <motion.div variants={proseVariants}>{proseBlock}</motion.div>
            </>
          ) : (
            <>
              {formBlock}
              {proseBlock}
            </>
          )}
        </>
      )}
    </div>
  )

  if (_useReact) {
    return (
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
        className={`${bg} py-12 sm:py-16 overflow-hidden`}
        data-module="prose-with-form"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">{content}</div>
      </motion.section>
    )
  }

  return (
    <section
      className={`${bg} py-12 sm:py-16`}
      data-module="prose-with-form"
      data-inline-type="select"
      data-inline-path="backgroundColor"
      data-inline-options={JSON.stringify([
        { label: 'Transparent', value: 'bg-transparent' },
        { label: 'Low', value: 'bg-backdrop-low' },
        { label: 'Medium', value: 'bg-backdrop-medium' },
        { label: 'High', value: 'bg-backdrop-high' },
        { label: 'Dark', value: 'bg-neutral-high' },
      ])}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">{content}</div>
    </section>
  )
}
