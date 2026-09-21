function generateOptions(max: number): number[] {
  if (max <= 10) return Array.from({ length: max + 1 }, (_, i) => i)
  if (max <= 20) {
    const opts: number[] = []
    for (let i = 0; i <= max; i += 2) opts.push(i)
    if (opts[opts.length - 1] !== max) opts.push(max)
    return opts
  }
  const opts: number[] = []
  for (let i = 0; i <= max; i += 5) opts.push(i)
  if (opts[opts.length - 1] !== max) opts.push(max)
  return opts
}

export function GradeInput({
  value, max, allowedMarks, onChange,
}: {
  value: number
  max: number
  allowedMarks: string
  onChange: (v: number) => void
}) {
  const options = allowedMarks
    ? allowedMarks.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n))
    : generateOptions(max)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', width: '100%' }}>
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            title={`${opt} / ${max}`}
            style={{
              minWidth: 32,
              height: 32,
              padding: '0 9px',
              borderRadius: '999px',
              border: `1.5px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
              background: active ? 'hsl(var(--primary))' : 'hsl(var(--background))',
              color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
              fontSize: '0.8rem',
              fontWeight: active ? 700 : 500,
              lineHeight: 1,
              cursor: 'pointer',
              transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              boxShadow: active ? '0 2px 8px -3px hsl(var(--primary) / 0.45)' : 'none',
            } as React.CSSProperties}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
