/**
 * Separator Module - Static Variant
 * 
 * Pure SSR component (no hydration, max performance)
 * Simple horizontal rule with no custom fields
 */

export default function SeparatorStatic() {
  return (
    <section className="py-8" data-module="separator">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <hr className="border-t border-line-low" />
      </div>
    </section>
  )
}

