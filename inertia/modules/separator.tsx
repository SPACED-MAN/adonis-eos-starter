import { getSectionStyles } from '../utils/colors'

export default function Separator() {
  const styles = getSectionStyles('transparent')

  return (
    <section className={`${styles.containerClasses} py-8`} data-module="separator">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <hr className="border-t border-line-high" />
      </div>
    </section>
  )
}
