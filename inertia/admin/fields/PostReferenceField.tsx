import PostCustomPostReferenceField from '../components/forms/PostCustomPostReferenceField'

type Props = {
  value: any
  onChange: (val: any) => void
  config?: Record<string, any>
}

export default function PostReferenceField({ value, onChange, config, ...rest }: any) {
  // CustomFieldRenderer spreads config into props, so postType/multiple might be top-level
  const effectiveConfig = {
    ...(config || {}),
    ...rest,
  }

  return (
    <PostCustomPostReferenceField
      label={effectiveConfig.label || 'Select post'}
      value={value}
      onChange={onChange}
      config={effectiveConfig}
    />
  )
}
