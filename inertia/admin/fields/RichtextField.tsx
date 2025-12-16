import { LexicalEditor } from '../components/LexicalEditor'

type Props = {
  value: any
  onChange: (val: any) => void
  editorKey: string
}

export default function RichtextField({ value, onChange, editorKey }: Props) {
  return <LexicalEditor editorKey={editorKey} value={value} onChange={onChange} />
}
