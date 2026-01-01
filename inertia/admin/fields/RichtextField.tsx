import { LexicalEditor } from '../components/LexicalEditor'

type Props = {
  value: any
  onChange: (val: any) => void
  editorKey?: string
  slug?: string
  customFields?: Array<{ slug: string; label: string }>
}

export default function RichtextField({
  value,
  onChange,
  editorKey,
  slug,
  customFields,
}: Props) {
  return (
    <LexicalEditor
      editorKey={editorKey || slug}
      value={value}
      onChange={onChange}
      customFields={customFields}
    />
  )
}
