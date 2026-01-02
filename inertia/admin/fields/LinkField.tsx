import { LinkField as InternalLinkField, type LinkFieldValue } from '~/components/forms/LinkField'

type Props = {
  value: LinkFieldValue | string | null
  onChange: (val: LinkFieldValue | string | null) => void
  allModules?: any[]
}

export default function LinkField({ value, onChange, allModules }: Props) {
  return (
    <InternalLinkField
      value={(value as any) ?? null}
      onChange={onChange}
      modules={allModules}
    />
  )
}
