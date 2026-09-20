'use client'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, KeyRound, Trash2, Shield, User, X, Loader2, ChevronDown, Building2, ArrowRightLeft } from 'lucide-react'
import type { UserRow, TagOption } from '@/app/(dashboard)/admin/users/page'
import type { Role } from '@/types/database'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', zIndex: 1, background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))', borderRadius: 'calc(var(--radius) * 2)',
        padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px -12px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--app-hero-text)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600 }}>{label}</Label>
      {children}
    </div>
  )
}

function SelectField({ name, defaultValue, children }: { name: string; defaultValue?: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        name={name}
        defaultValue={defaultValue}
        style={{
          width: '100%', padding: '8px 32px 8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontSize: '0.88rem',
          appearance: 'none', cursor: 'pointer',
        }}
      >
        {children}
      </select>
      <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'hsl(var(--muted-foreground))' }} />
    </div>
  )
}

interface Props {
  users: UserRow[]
  currentUserId: string
  tags: TagOption[]
  isInstitutionAdmin: boolean
  callerTagId: string | null
  createUser: (fd: FormData) => Promise<void>
  updateRole: (fd: FormData) => Promise<void>
  moveToTag: (fd: FormData) => Promise<void>
  setPassword: (fd: FormData) => Promise<void>
  deleteUser: (fd: FormData) => Promise<void>
}

export function UsersClient({
  users, currentUserId, tags, isInstitutionAdmin, callerTagId,
  createUser, updateRole, moveToTag, setPassword, deleteUser,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [pwdUser, setPwdUser] = useState<UserRow | null>(null)
  const [moveUser, setMoveUser] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const createFormRef = useRef<HTMLFormElement>(null)
  const pwdFormRef = useRef<HTMLFormElement>(null)
  const moveFormRef = useRef<HTMLFormElement>(null)

  function flash(msg: string, type: 'ok' | 'err') {
    if (type === 'ok') { setSuccess(msg); setError(null) }
    else { setError(msg); setSuccess(null) }
    setTimeout(() => { setSuccess(null); setError(null) }, 4000)
  }

  function act(fn: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn()
        flash(successMsg, 'ok')
        router.refresh()
      } catch (e: unknown) {
        flash(e instanceof Error ? e.message : 'Something went wrong', 'err')
      }
    })
  }

  const showTagColumn = isInstitutionAdmin

  return (
    <div style={{ padding: '0 0 48px' }}>
      {/* Top bar */}
      <div className="dashboard-topbar" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p className="eyebrow">{isInstitutionAdmin ? 'Institution Admin' : 'Admin'}</p>
          <h1 className="section-title" style={{ marginTop: 6 }}>Users</h1>
          <p className="section-subtitle">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 flex-shrink-0" size="sm">
          <UserPlus size={15} /> New User
        </Button>
      </div>

      {/* Feedback banner */}
      {(error || success) && (
        <div style={{ margin: '0 24px 16px', padding: '12px 16px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 500,
          background: error ? '#fff5f5' : '#f0fdf4',
          border: `1px solid ${error ? '#fecaca' : '#bbf7d0'}`,
          color: error ? '#991b1b' : '#166534',
        }}>
          {error ?? success}
        </div>
      )}

      {/* Table */}
      <div style={{ margin: '0 24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: showTagColumn ? 700 : 600 }}>
          <thead>
            <tr style={{ background: 'hsl(var(--muted))', borderBottom: '2px solid hsl(var(--border))' }}>
              {['Name', 'Email', ...(showTagColumn ? ['TAG'] : []), 'Role', 'Joined', 'Last Sign In', 'Actions'].map((h) => (
                <th key={h} style={{
                  padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700,
                  letterSpacing: '0.05em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))',
                  borderRight: '1px solid hsl(var(--border) / 0.4)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const isMe = u.id === currentUserId
              const rowBg = i % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.3)'
              return (
                <tr key={u.id} style={{ background: rowBg, borderBottom: '1px solid hsl(var(--border) / 0.35)' }}>
                  <td style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--app-hero-text)', whiteSpace: 'nowrap' }}>
                    {u.name || '—'}
                    {isMe && <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'hsl(var(--primary))', fontWeight: 700 }}>you</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'hsl(var(--muted-foreground))' }}>{u.email}</td>
                  {showTagColumn && (
                    <td style={{ padding: '10px 14px' }}>
                      {u.tag_short_name ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                          borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                          background: 'hsl(var(--primary) / 0.08)', color: 'hsl(var(--primary))',
                          border: '1px solid hsl(var(--primary) / 0.2)',
                        }}>
                          {u.tag_short_name}
                        </span>
                      ) : <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem' }}>—</span>}
                    </td>
                  )}
                  <td style={{ padding: '10px 14px' }}>
                    <RolePill
                      user={u}
                      isMe={isMe}
                      isPending={isPending}
                      isInstitutionAdmin={isInstitutionAdmin}
                      updateRole={updateRole}
                      act={act}
                    />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                    {formatDate(u.created_at)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                    {formatDate(u.last_sign_in_at)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {isInstitutionAdmin && (
                        <button
                          onClick={() => setMoveUser(u)}
                          title="Move to a different TAG"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', cursor: 'pointer' }}
                        >
                          <ArrowRightLeft size={12} /> TAG
                        </button>
                      )}
                      <button
                        onClick={() => setPwdUser(u)}
                        title="Set password"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', cursor: 'pointer' }}
                      >
                        <KeyRound size={12} /> Password
                      </button>
                      {!isMe && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          title="Delete user"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, border: '1px solid hsl(var(--destructive) / 0.3)', background: 'hsl(var(--destructive) / 0.06)', color: 'hsl(var(--destructive))', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <Modal title="New User" onClose={() => setShowCreate(false)}>
          <form
            ref={createFormRef}
            action={async (fd) => {
              act(async () => { await createUser(fd) }, 'User created successfully')
              setShowCreate(false)
              createFormRef.current?.reset()
            }}
          >
            <FormField label="Full Name">
              <Input name="name" placeholder="Dr. Jane Smith" required />
            </FormField>
            <FormField label="Email">
              <Input name="email" type="email" placeholder="faculty@cb.amrita.edu" required />
            </FormField>
            <FormField label="Password">
              <Input name="password" type="password" placeholder="Temporary password" required minLength={8} />
            </FormField>
            <FormField label="Role">
              <SelectField name="role" defaultValue="faculty">
                <option value="faculty">Faculty</option>
                <option value="admin">TAG Admin</option>
                {isInstitutionAdmin && <option value="institution_admin">Institution Admin</option>}
              </SelectField>
            </FormField>
            {isInstitutionAdmin && (
              <FormField label="TAG">
                <SelectField name="tag_id" defaultValue={callerTagId ?? ''}>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>{t.short_name} — {t.name}</option>
                  ))}
                </SelectField>
              </FormField>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Button type="submit" className="flex-1 gap-2" disabled={isPending}>
                {isPending ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><UserPlus size={14} /> Create User</>}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Move to TAG modal */}
      {moveUser && (
        <Modal title={`Move to TAG — ${moveUser.name || moveUser.email}`} onClose={() => setMoveUser(null)}>
          <form
            ref={moveFormRef}
            action={async (fd) => {
              fd.append('userId', moveUser.id)
              act(async () => { await moveToTag(fd) }, `${moveUser.name || moveUser.email} moved to new TAG`)
              setMoveUser(null)
              moveFormRef.current?.reset()
            }}
          >
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>
              Currently in <strong style={{ color: 'var(--app-hero-text)' }}>{moveUser.tag_short_name ?? 'no TAG'}</strong>. Pick a new TAG:
            </p>
            <FormField label="Destination TAG">
              <SelectField name="tag_id" defaultValue={moveUser.tag_id ?? ''}>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.short_name} — {t.name}</option>
                ))}
              </SelectField>
            </FormField>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Button type="submit" className="flex-1 gap-2" disabled={isPending}>
                {isPending ? <><Loader2 size={14} className="animate-spin" /> Moving…</> : <><ArrowRightLeft size={14} /> Move</>}
              </Button>
              <Button type="button" variant="outline" onClick={() => setMoveUser(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Set password modal */}
      {pwdUser && (
        <Modal title={`Set Password — ${pwdUser.name || pwdUser.email}`} onClose={() => setPwdUser(null)}>
          <form
            ref={pwdFormRef}
            action={async (fd) => {
              fd.append('userId', pwdUser.id)
              act(async () => { await setPassword(fd) }, 'Password updated')
              setPwdUser(null)
              pwdFormRef.current?.reset()
            }}
          >
            <FormField label="New Password">
              <Input name="password" type="password" placeholder="Min. 8 characters" required minLength={8} autoFocus />
            </FormField>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Button type="submit" className="flex-1 gap-2" disabled={isPending}>
                {isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><KeyRound size={14} /> Set Password</>}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPwdUser(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <Modal title="Delete User?" onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: '0.88rem', color: 'hsl(var(--muted-foreground))', marginBottom: 20 }}>
            This removes <strong style={{ color: 'var(--app-hero-text)' }}>{deleteTarget.name || deleteTarget.email}</strong> and all the grades they&apos;ve entered. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              disabled={isPending}
              onClick={() => {
                const fd = new FormData()
                fd.append('userId', deleteTarget.id)
                act(async () => { await deleteUser(fd) }, 'User deleted')
                setDeleteTarget(null)
              }}
            >
              {isPending ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete</>}
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function RolePill({ user, isMe, isPending, isInstitutionAdmin, updateRole, act }: {
  user: UserRow
  isMe: boolean
  isPending: boolean
  isInstitutionAdmin: boolean
  updateRole: (fd: FormData) => Promise<void>
  act: (fn: () => Promise<void>, msg: string) => void
}) {
  const isInstAdmin = user.role === 'institution_admin'
  const isTagAdmin = user.role === 'admin'

  function cycleRole() {
    let newRole: Role
    if (isInstitutionAdmin) {
      // cycle: faculty → admin → institution_admin → faculty
      if (user.role === 'faculty') newRole = 'admin'
      else if (user.role === 'admin') newRole = 'institution_admin'
      else newRole = 'faculty'
    } else {
      newRole = isTagAdmin ? 'faculty' : 'admin'
    }
    const fd = new FormData()
    fd.append('userId', user.id)
    fd.append('role', newRole)
    act(async () => { await updateRole(fd) }, `${user.name || user.email} is now ${newRole}`)
  }

  const label = isInstAdmin ? 'Institution Admin' : isTagAdmin ? 'TAG Admin' : 'Faculty'
  const icon = isInstAdmin ? <Building2 size={11} /> : isTagAdmin ? <Shield size={11} /> : <User size={11} />
  const accent = isInstAdmin
    ? { bg: 'hsl(327 73% 97%)', color: 'hsl(336 75% 35%)', border: 'hsl(327 60% 80%)' }
    : isTagAdmin
      ? { bg: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', border: 'hsl(var(--primary) / 0.3)' }
      : { bg: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))' }

  return (
    <button
      onClick={cycleRole}
      disabled={isPending || isMe}
      title={isMe ? 'Cannot change your own role' : `Click to cycle role`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
        border: `1px solid ${accent.border}`,
        background: accent.bg,
        color: accent.color,
        cursor: isMe ? 'default' : 'pointer',
        opacity: isPending ? 0.5 : 1,
        transition: 'all 140ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
