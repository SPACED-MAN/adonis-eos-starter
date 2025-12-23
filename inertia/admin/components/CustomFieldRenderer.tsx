import React, { useMemo } from 'react'
import { CustomFieldDefinition } from '~/types/custom_field'
import { Input } from '~/components/ui/input'
import { LabelWithDescription } from '~/components/forms/LabelWithDescription'

interface CustomFieldRendererProps {
  definitions: CustomFieldDefinition[]
  values: Record<string, any>
  onChange: (slug: string, value: any) => void
  onDirty?: () => void
  level?: number
  // For TokenField support
  customFields?: Array<{ slug: string; label: string }>
  // For showIf visibility checks
  allValues?: Record<string, any>
}

export function CustomFieldRenderer({
  definitions,
  values,
  onChange,
  onDirty,
  level = 0,
  customFields,
  allValues,
}: CustomFieldRendererProps) {
  const fieldComponents = useMemo(() => {
    const modules = import.meta.glob('../fields/*.tsx', { eager: true }) as Record<
      string,
      { default: any }
    >
    const map: Record<string, any> = {}
    Object.entries(modules).forEach(([path, mod]) => {
      const name = path
        .split('/')
        .pop()
        ?.replace(/\.\w+$/, '')
      if (name && mod?.default) {
        map[name] = mod.default
      }
    })
    return map
  }, [])

  const pascalFromType = (t: string) =>
    t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')

  const groups = useMemo(() => {
    const groups: Record<string, CustomFieldDefinition[]> = {}
    definitions.forEach((d) => {
      const cat = d.category || 'General'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(d)
    })
    return groups
  }, [definitions])

  const checkShowIf = (f: CustomFieldDefinition) => {
    if (!f.showIf) return true
    const { field, equals, notEquals } = f.showIf
    const depValue = (allValues || values)[field]

    if (equals !== undefined && depValue !== equals) return false
    if (notEquals !== undefined && depValue === notEquals) return false
    // Note: isVideo check omitted for simplicity here, but can be added if media metadata is available
    return true
  }

  const renderField = (f: CustomFieldDefinition) => {
    if (!checkShowIf(f)) return null

    const val = values[f.slug]
    const handleChange = (next: any) => {
      onChange(f.slug, next)
      if (onDirty) onDirty()
    }

    if (f.type === 'object' && f.fields) {
      return (
        <div key={f.slug} className="space-y-2">
          <LabelWithDescription label={f.label} description={f.description} />
          <div className="pl-4 border-l-2 border-line-low ml-1">
            <CustomFieldRenderer
              definitions={f.fields}
              values={val || {}}
              onChange={(subSlug, subVal) => {
                const nextObj = { ...(val || {}), [subSlug]: subVal }
                handleChange(nextObj)
              }}
              onDirty={onDirty}
              level={level + 1}
              customFields={customFields}
              allValues={allValues || values}
            />
          </div>
        </div>
      )
    }

    if (f.type === 'repeater' && f.item) {
      const items = Array.isArray(val) ? val : []
      return (
        <div key={f.slug} className="space-y-4">
          <LabelWithDescription label={f.label} description={f.description} />
          <div className="space-y-4 pl-4 border-l-2 border-line-low ml-1">
            {items.map((itemVal, idx) => (
              <div key={idx} className="relative group p-4 bg-backdrop-medium/5 rounded-lg border border-line-low">
                <button
                  type="button"
                  className="absolute top-2 right-2 p-1 text-neutral-low hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    const nextItems = [...items]
                    nextItems.splice(idx, 1)
                    handleChange(nextItems)
                  }}
                >
                  Remove
                </button>
                <CustomFieldRenderer
                  definitions={f.item?.type === 'object' ? (f.item.fields || []) : [f.item!]}
                  values={f.item?.type === 'object' ? (itemVal || {}) : { [f.item!.slug]: itemVal }}
                  onChange={(subSlug, subVal) => {
                    const nextItems = [...items]
                    if (f.item?.type === 'object') {
                      nextItems[idx] = { ...(itemVal || {}), [subSlug]: subVal }
                    } else {
                      nextItems[idx] = subVal
                    }
                    handleChange(nextItems)
                  }}
                  onDirty={onDirty}
                  level={level + 1}
                  customFields={customFields}
                  allValues={allValues || values}
                />
              </div>
            ))}
            <button
              type="button"
              className="w-full py-2 text-xs border border-dashed border-line-medium rounded-lg text-neutral-medium hover:bg-backdrop-medium/10 transition-colors"
              onClick={() => {
                const empty: any = f.item?.type === 'object' ? {} : ''
                handleChange([...items, empty])
              }}
            >
              + Add Item
            </button>
          </div>
        </div>
      )
    }

    const compName = `${pascalFromType(f.type)}Field`
    const Renderer = (fieldComponents as Record<string, any>)[compName]

    if (Renderer) {
      // Destructure to avoid passing unwanted props to DOM elements via spread
      const {
        type: _type,
        fieldType: _fieldType,
        translatable: _translatable,
        config,
        value: _value,
        ...rest
      } = f

      return (
        <div key={f.slug}>
          <LabelWithDescription label={f.label} description={f.description} />
          <Renderer
            value={val ?? null}
            onChange={handleChange}
            customFields={customFields}
            {...rest}
            {...(config || {})}
          />
        </div>
      )
    }

    // Fallback
    return (
      <div key={f.slug}>
        <LabelWithDescription label={f.label} description={f.description} />
        <Input
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={f.type === 'url' ? 'https://' : ''}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([category, fields]) => (
        <div key={category} className="space-y-4">
          {category !== 'General' && level === 0 && (
            <h4 className="text-[11px] font-bold text-neutral-medium uppercase tracking-wider border-b border-line-low pb-2 mb-4">
              {category}
            </h4>
          )}
          <div className="space-y-4">
            {fields.map(renderField).filter(Boolean)}
          </div>
        </div>
      ))}
    </div>
  )
}
