interface Props {
  value: number;
  onChange(v: number): void;
  label: string;
  id?: string;
}

/** 0–1 range input whose filled track is drawn from the --fill custom property. */
export function Slider({ value, onChange, label, id }: Props) {
  return (
    <input
      id={id}
      className="slider"
      type="range"
      min={0}
      max={100}
      step={1}
      value={Math.round(value * 100)}
      aria-label={label}
      aria-valuetext={`${Math.round(value * 100)}%`}
      style={{ '--fill': `${value * 100}%` } as React.CSSProperties}
      onChange={(e) => onChange(Number(e.currentTarget.value) / 100)}
    />
  );
}
