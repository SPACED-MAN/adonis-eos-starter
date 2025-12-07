import { LinkField as InternalLinkField, type LinkFieldValue } from '~/components/forms/LinkField'

type Props = {
  value: LinkFieldValue | string | null
  onChange: (val: LinkFieldValue | string | null) => void
}

export default function LinkField({ value, onChange }: Props) {
  return <InternalLinkField value={(value as any) ?? null} onChange={onChange} />
}

