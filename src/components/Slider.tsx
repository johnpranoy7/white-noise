interface Props {
  value: number;
  onChange(v: number): void;
  label: string;
  id?: string;
  /** Upper limit (0–1). The track spans 0 to max, so a capped slider is still full width. */
  max?: number;
}

/** 0–1 range input whose filled track is drawn from the --fill custom property. */
export function Slider({ value, onChange, label, id, max = 1 }: Props) {
  return (
    <input
      id={id}
      className="slider"
      type="range"
      min={0}
      max={Math.round(max * 100)}
      step={1}
      value={Math.round(value * 100)}
      aria-label={label}
      aria-valuetext={`${Math.round(value * 100)}%`}
      style={{ '--fill': `${(value / max) * 100}%` } as React.CSSProperties}
      onChange={(e) => onChange(Number(e.currentTarget.value) / 100)}
    />
  );
}
