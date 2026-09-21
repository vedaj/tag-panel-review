import { ArrowLeft, Lock } from 'lucide-react'
import { FlaskConical, Smartphone, Code2 } from 'lucide-react'
import Link from 'next/link'
import type { Group, ProjectType } from '@/types/database'

export const PROJECT_TYPES: { value: ProjectType; label: string; description: string; Icon: React.ElementType }[] = [
  { value: 'research',    label: 'Research Based',    description: 'Literature survey, analysis & novel findings',       Icon: FlaskConical },
  { value: 'application', label: 'Application Based', description: 'App development solving a real-world problem',        Icon: Smartphone  },
  { value: 'software',    label: 'Software Based',    description: 'Full software system with architecture & modules',    Icon: Code2       },
]

export function ProjectTypeSelector({
  group,
  projectTitle,
  onProjectTitleChange,
  isAdmin,
  isChangingType,
  settingType,
  onSelectType,
  onBack,
}: {
  group: Group
  projectTitle: string
  onProjectTitleChange: (val: string) => void
  isAdmin: boolean
  isChangingType: boolean
  settingType: boolean
  onSelectType: (type: ProjectType) => void
  onBack: () => void
}) {
  return (
    <div className="min-h-screen bg-background md:pt-0 pt-14 flex items-start justify-center">
      <div className="w-full max-w-2xl px-4 md:px-8 py-10">
        {isChangingType ? (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ArrowLeft size={16} /> Back to Grading
          </button>
        ) : (
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => onProjectTitleChange(e.target.value)}
            placeholder="Enter project title…"
            style={{
              marginTop: 6,
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--app-panel-border)',
              outline: 'none',
              fontSize: '0.95rem',
              color: 'var(--app-hero-subtext)',
              padding: '2px 0 4px',
            }}
          />
        </div>

        {isAdmin ? (
          <div style={{
            padding: '24px',
            border: '1px solid var(--app-panel-border)',
            borderRadius: '20px',
            background: 'linear-gradient(180deg, var(--app-panel-strong), var(--app-panel))',
          }}>
            <p className="eyebrow mb-2">{isChangingType ? 'Change' : 'Step 1'}</p>
            <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--title-font)', fontSize: '1.4rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>
              {isChangingType ? 'Change Project Type' : 'Select Project Type'}
            </h2>
            <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.88rem', marginBottom: '20px' }}>
              {isChangingType
                ? "Change the type — your existing marks won't be lost."
                : "Pick the type that fits this group's work. It decides which rubric you'll see."}
            </p>
            <div style={{ display: 'grid', gap: '12px' }}>
              {PROJECT_TYPES.map(({ value, label, description, Icon }) => (
                <button
                  key={value}
                  disabled={settingType}
                  onClick={() => onSelectType(value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '16px 20px', borderRadius: '14px',
                    border: '1px solid var(--app-panel-border)',
                    background: 'var(--app-panel-strong)',
                    cursor: settingType ? 'wait' : 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 140ms ease, transform 140ms ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(var(--primary))'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--app-panel-border)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 44, height: 44, borderRadius: '12px',
                    background: 'var(--app-accent-soft)', color: 'var(--app-kicker)',
                    flexShrink: 0,
                  }}>
                    <Icon size={20} />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, color: 'var(--app-hero-text)' }}>{label}</span>
                    <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--app-hero-subtext)', marginTop: 2 }}>{description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '32px 28px',
            border: '1px solid var(--app-panel-border)',
            borderRadius: '20px',
            background: 'linear-gradient(180deg, var(--app-panel-strong), var(--app-panel))',
            textAlign: 'center',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 52, height: 52, borderRadius: '14px',
              background: 'var(--app-accent-soft)', color: 'var(--app-kicker)',
              marginBottom: 16,
            }}>
              <Lock size={22} />
            </span>
            <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--title-font)', fontSize: '1.3rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>
              Project Type Not Set
            </h2>
            <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
              No project type has been set for <strong>{group.name}</strong> yet. Ask your admin to assign one before you start grading.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
