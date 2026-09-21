import { X } from 'lucide-react'

export function RubricPopup({
  popup,
  onClose,
}: {
  popup: { title: string; text: string } | null
  onClose: () => void
}) {
  if (!popup) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', padding: '16px' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--app-panel-strong)',
          border: '1px solid var(--app-panel-border)',
          borderRadius: 20,
          padding: '24px 28px',
          maxWidth: 500,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--app-kicker)', marginBottom: 4 }}>Rubric</p>
            <h3 style={{ margin: 0, fontFamily: 'var(--title-font)', fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--app-hero-text)', lineHeight: 1.25 }}>
              {popup.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'hsl(var(--muted))', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', color: 'var(--app-hero-subtext)', flexShrink: 0, touchAction: 'manipulation' }}
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--app-hero-subtext)' }}>
          {popup.text}
        </p>
      </div>
    </div>
  )
}
