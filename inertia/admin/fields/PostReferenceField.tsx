import PostCustomPostReferenceField from '../components/forms/PostCustomPostReferenceField'

type Props = {
  value: any
  onChange: (val: any) => void
  config?: Record<string, any>
}

export default function PostReferenceField({ value, onChange, config }: Props) {
  return (
    <PostCustomPostReferenceField
      label={config?.label || 'Select post'}
      value={value}
      onChange={onChange}
      config={config}
    />
  )
}

