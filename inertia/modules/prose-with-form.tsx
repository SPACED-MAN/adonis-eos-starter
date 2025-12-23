import { motion } from 'framer-motion'
import FormModule from './form'

interface ProseWithFormProps {
  title: string
  body?: string | null
  formSlug: string
  layout?: 'form-right' | 'form-left'
  backgroundColor?: string
  _useReact?: boolean
}

export default function ProseWithForm({
  title,
  body,
  formSlug,
  layout = 'form-right',
  backgroundColor = 'bg-backdrop-low',
  _useReact,
}: ProseWithFormProps) {
  const isFormRight = layout === 'form-right'

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
        className={`${backgroundColor} py-12 sm:py-16 overflow-hidden`}
        data-module="prose-with-form"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {content}
        </div>
      </motion.section>
    )
  }

  return (
    <section className={`${backgroundColor} py-12 sm:py-16`} data-module="prose-with-form">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {content}
      </div>
    </section>
  )
}

