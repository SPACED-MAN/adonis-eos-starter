import { LexicalEditor } from '../components/LexicalEditor'

type Props = {
  value: any
  onChange: (val: any) => void
  editorKey: string
  customFields?: Array<{ slug: string; label: string }>
}

export default function RichtextField({ value, onChange, editorKey, customFields }: Props) {
  return <LexicalEditor editorKey={editorKey} value={value} onChange={onChange} customFields={customFields} />
}
