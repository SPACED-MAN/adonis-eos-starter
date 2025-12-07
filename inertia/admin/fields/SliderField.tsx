import { Slider } from '~/components/ui/slider'
import { Input } from '~/components/ui/input'
import { useState, useEffect } from 'react'

type Props = {
  value: number | null
  onChange: (val: number | null) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

export default function SliderField({ value, onChange, min = 0, max = 100, step = 1, unit }: Props) {
  const [internal, setInternal] = useState<number>(typeof value === 'number' ? value : min)

  useEffect(() => {
    if (typeof value === 'number') setInternal(value)
  }, [value])

  return (
    <div className="space-y-2">
      <Slider
        min={min}
        max={max}
        step={step}
        value={[internal]}
        onValueChange={([v]) => {
          setInternal(v)
          onChange(v)
        }}
      />
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="w-24"
          value={internal}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isNaN(v)) {
              setInternal(v)
              onChange(v)
            } else {
              onChange(null)
            }
          }}
        />
        {unit && <span className="text-sm text-neutral-medium">{unit}</span>}
      </div>
    </div>
  )
}


