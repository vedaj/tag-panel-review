"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ArrowRightLeft,
	Building2,
	CheckCircle2,
	ChevronDown,
	Clock,
	ClipboardList,
	GraduationCap,
	KeyRound,
	Loader2,
	Search,
	Shield,
	Trash2,
	UserPlus,
	X,
} from "lucide-react";
import type {
	AssignmentSummary,
	TagOption,
	UserContext,
	UserRow,
} from "@/app/(dashboard)/admin/users/page";
import type { Program } from "@/types/database";
import { useAccess } from "@/components/AccessContext";
import {
	assignableRoles,
	canManageUser,
	hasRole,
	roleLabels,
	type AssignableRole,
} from "@/lib/roles";
import { programLabel, programTerms } from "@/lib/programs";

function formatDate(iso: string | null) {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function initialsOf(name: string, email: string) {
	const src = name.trim() || email;
	return src
		.split(/\s+/)
		.map((w) => w[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

function Modal({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className="users-modal">
			<div className="users-modal-backdrop" onClick={onClose} />
			<div className="users-modal-card">
				<div className="users-modal-head">
					<h2>{title}</h2>
					<button onClick={onClose} aria-label="Close">
						<X size={18} />
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div style={{ marginBottom: 16 }}>
			<Label style={{ display: "block", marginBottom: 6, fontSize: "0.82rem", fontWeight: 600 }}>
				{label}
			</Label>
			{children}
		</div>
	);
}

function SelectField({
	name,
	defaultValue,
	children,
}: {
	name: string;
	defaultValue?: string;
	children: React.ReactNode;
}) {
	return (
		<div style={{ position: "relative" }}>
			<select name={name} defaultValue={defaultValue} className="users-select">
				{children}
			</select>
			<ChevronDown size={14} className="users-select-chevron" />
		</div>
	);
}

interface Props {
	users: UserRow[];
	contexts: Record<string, UserContext>;
	/** Programs shown side by side: both for institution admins, else the active one */
	programs: Program[];
	tags: TagOption[];
	createUser: (fd: FormData) => Promise<void>;
	setRole: (fd: FormData) => Promise<void>;
	moveToTag: (fd: FormData) => Promise<void>;
	setPassword: (fd: FormData) => Promise<void>;
	deleteUser: (fd: FormData) => Promise<void>;
}

export function UsersClient({
	users,
	contexts,
	programs,
	tags,
	createUser,
	setRole,
	moveToTag,
	setPassword,
	deleteUser,
}: Props) {
	const access = useAccess();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [search, setSearch] = useState("");
	const [tagFilter, setTagFilter] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [pwdUser, setPwdUser] = useState<UserRow | null>(null);
	const [moveUser, setMoveUser] = useState<UserRow | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const createFormRef = useRef<HTMLFormElement>(null);
	const pwdFormRef = useRef<HTMLFormElement>(null);
	const moveFormRef = useRef<HTMLFormElement>(null);

	const isInstitutionAdmin = access.isInstitutionAdmin;
	const canMove = access.isInstitutionAdmin || access.isProgramAdmin;
	const showTagFilter = access.tagFilter === null;
	const tagName = (id: string | null) => tags.find((t) => t.id === id)?.short_name ?? null;

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return users.filter(
			(u) =>
				(!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
				(!tagFilter || (tagFilter === "none" ? !u.tag_id : u.tag_id === tagFilter)),
		);
	}, [users, search, tagFilter]);

	const selected = users.find((u) => u.id === selectedId) ?? null;

	function flash(msg: string, type: "ok" | "err") {
		if (type === "ok") {
			setSuccess(msg);
			setError(null);
		} else {
			setError(msg);
			setSuccess(null);
		}
		setTimeout(() => {
			setSuccess(null);
			setError(null);
		}, 4000);
	}

	function act(fn: () => Promise<void>, successMsg: string) {
		startTransition(async () => {
			try {
				await fn();
				flash(successMsg, "ok");
				router.refresh();
			} catch (e: unknown) {
				flash(e instanceof Error ? e.message : "Something went wrong", "err");
			}
		});
	}

	function toggleRole(u: UserRow, r: AssignableRole, grant: boolean) {
		const fd = new FormData();
		fd.append("userId", u.id);
		fd.append("role", r.role);
		fd.append("program", r.program ?? "");
		fd.append("grant", String(grant));
		act(
			async () => {
				await setRole(fd);
			},
			`${u.name || u.email}: ${r.label} ${grant ? "granted" : "removed"}`,
		);
	}

	return (
		<div style={{ padding: "0 0 48px" }}>
			<div className="dashboard-topbar users-topbar">
				<div>
					<p className="eyebrow">{access.roleLabel}</p>
					<h1 className="section-title" style={{ marginTop: 6 }}>
						Users
					</h1>
					<p className="section-subtitle">
						{users.length} {users.length === 1 ? "person" : "people"}
						{access.tagFilter && tagName(access.tagFilter)
							? ` in ${tagName(access.tagFilter)}`
							: ""}
						{programs.length === 1 ? ` · ${programLabel(programs[0])}` : " · B.Tech & M.Tech"}
					</p>
				</div>
				{isInstitutionAdmin && (
					<Button onClick={() => setShowCreate(true)} className="gap-2 flex-shrink-0" size="sm">
						<UserPlus size={15} /> New User
					</Button>
				)}
			</div>

			{(error || success) && (
				<div className={`users-banner${error ? " is-error" : ""}`}>{error ?? success}</div>
			)}

			<div className={`users-layout${selected ? " has-selection" : ""}`}>
				{/* People */}
				<div className="users-list-panel">
					<div className="users-list-tools">
						<div className="users-search">
							<Search size={14} />
							<input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search name or email"
								aria-label="Search people"
							/>
						</div>
						{showTagFilter && (
							<select
								className="users-select users-tag-filter"
								value={tagFilter}
								onChange={(e) => setTagFilter(e.target.value)}
								aria-label="Filter by TAG"
							>
								<option value="">All TAGs</option>
								{tags.map((t) => (
									<option key={t.id} value={t.id}>
										{t.short_name}
									</option>
								))}
								<option value="none">No TAG</option>
							</select>
						)}
					</div>

					<ul className="users-list">
						{filtered.map((u) => {
							const labels = roleLabels(u.roles);
							return (
								<li key={u.id}>
									<button
										className={`users-list-row${u.id === selectedId ? " is-selected" : ""}`}
										onClick={() => setSelectedId(u.id)}
									>
										<span className="users-avatar">{initialsOf(u.name, u.email)}</span>
										<span className="users-list-main">
											<span className="users-list-name">
												{u.name || u.email}
												{u.id === access.userId && <span className="users-you">you</span>}
											</span>
											<span className="users-list-email">{u.email}</span>
										</span>
										<span className="users-list-meta">
											{u.tag_short_name && <span className="users-chip">{u.tag_short_name}</span>}
											{labels.length > 0 ? (
												<span className="users-chip is-role" title={labels.join(", ")}>
													<Shield size={10} />{" "}
													{labels.length > 1 ? `${labels.length} roles` : labels[0]}
												</span>
											) : null}
										</span>
									</button>
								</li>
							);
						})}
						{filtered.length === 0 && <li className="users-empty">No one matches.</li>}
					</ul>
				</div>

				{/* Profile */}
				<div className="users-profile-panel">
					{selected ? (
						<UserProfile
							key={selected.id}
							user={selected}
							context={contexts[selected.id] ?? { guide: [], panel: [] }}
							programs={programs}
							tagName={tagName}
							isPending={isPending}
							onClose={() => setSelectedId(null)}
							onToggleRole={(r, grant) => toggleRole(selected, r, grant)}
							onPassword={() => setPwdUser(selected)}
							onMove={canMove ? () => setMoveUser(selected) : undefined}
							onDelete={
								isInstitutionAdmin && selected.id !== access.userId
									? () => setDeleteTarget(selected)
									: undefined
							}
						/>
					) : (
						<div className="users-profile-empty">
							<Shield size={28} />
							<p>Select someone to see their TAG, roles and assignments.</p>
						</div>
					)}
				</div>
			</div>

			{/* Create user */}
			{showCreate && (
				<Modal title="New User" onClose={() => setShowCreate(false)}>
					<form
						ref={createFormRef}
						action={async (fd) => {
							act(async () => {
								await createUser(fd);
							}, "User created successfully");
							setShowCreate(false);
							createFormRef.current?.reset();
						}}
					>
						<FormField label="Full Name">
							<Input name="name" placeholder="Dr. Jane Smith" required />
						</FormField>
						<FormField label="Email">
							<Input name="email" type="email" placeholder="faculty@cb.amrita.edu" required />
						</FormField>
						<FormField label="Password">
							<Input
								name="password"
								type="password"
								placeholder="Temporary password"
								required
								minLength={8}
							/>
						</FormField>
						<FormField label="TAG">
							<SelectField name="tag_id" defaultValue={access.tagId ?? ""}>
								{tags.map((t) => (
									<option key={t.id} value={t.id}>
										{t.short_name} — {t.name}
									</option>
								))}
							</SelectField>
						</FormField>
						<label className="users-checkbox">
							<input type="checkbox" name="tag_admin" />
							Also make {programLabel(access.program)} TAG admin of this TAG
						</label>
						<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
							<Button type="submit" className="flex-1 gap-2" disabled={isPending}>
								{isPending ? (
									<>
										<Loader2 size={14} className="animate-spin" /> Creating…
									</>
								) : (
									<>
										<UserPlus size={14} /> Create User
									</>
								)}
							</Button>
							<Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
								Cancel
							</Button>
						</div>
					</form>
				</Modal>
			)}

			{/* Move to another TAG */}
			{moveUser && (
				<Modal
					title={`Move to TAG — ${moveUser.name || moveUser.email}`}
					onClose={() => setMoveUser(null)}
				>
					<form
						ref={moveFormRef}
						action={async (fd) => {
							fd.append("userId", moveUser.id);
							act(
								async () => {
									await moveToTag(fd);
								},
								`${moveUser.name || moveUser.email} moved to a new TAG`,
							);
							setMoveUser(null);
							moveFormRef.current?.reset();
						}}
					>
						<p className="users-muted" style={{ marginBottom: 12 }}>
							Currently in <strong>{moveUser.tag_short_name ?? "no TAG"}</strong>. A TAG is shared
							by B.Tech and M.Tech, so the move applies to both.
						</p>
						<MoveWarning user={moveUser} context={contexts[moveUser.id]} />
						<FormField label="Destination TAG">
							<SelectField name="tag_id" defaultValue={moveUser.tag_id ?? ""}>
								{tags.map((t) => (
									<option key={t.id} value={t.id}>
										{t.short_name} — {t.name}
									</option>
								))}
							</SelectField>
						</FormField>
						<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
							<Button type="submit" className="flex-1 gap-2" disabled={isPending}>
								<ArrowRightLeft size={14} /> Move
							</Button>
							<Button type="button" variant="outline" onClick={() => setMoveUser(null)}>
								Cancel
							</Button>
						</div>
					</form>
				</Modal>
			)}

			{/* Set password */}
			{pwdUser && (
				<Modal
					title={`Set Password — ${pwdUser.name || pwdUser.email}`}
					onClose={() => setPwdUser(null)}
				>
					<form
						ref={pwdFormRef}
						action={async (fd) => {
							fd.append("userId", pwdUser.id);
							act(async () => {
								await setPassword(fd);
							}, "Password updated");
							setPwdUser(null);
							pwdFormRef.current?.reset();
						}}
					>
						<FormField label="New Password">
							<Input
								name="password"
								type="password"
								placeholder="Min. 8 characters"
								required
								minLength={8}
								autoFocus
							/>
						</FormField>
						<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
							<Button type="submit" className="flex-1 gap-2" disabled={isPending}>
								<KeyRound size={14} /> Set Password
							</Button>
							<Button type="button" variant="outline" onClick={() => setPwdUser(null)}>
								Cancel
							</Button>
						</div>
					</form>
				</Modal>
			)}

			{/* Delete */}
			{deleteTarget && (
				<Modal title="Remove User?" onClose={() => setDeleteTarget(null)}>
					<p className="users-muted" style={{ marginBottom: 20 }}>
						This removes <strong>{deleteTarget.name || deleteTarget.email}</strong> and all the
						grades they&apos;ve entered. This cannot be undone.
					</p>
					<div style={{ display: "flex", gap: 8 }}>
						<Button
							variant="destructive"
							className="flex-1 gap-2"
							disabled={isPending}
							onClick={() => {
								const fd = new FormData();
								fd.append("userId", deleteTarget.id);
								act(async () => {
									await deleteUser(fd);
								}, "User removed");
								setDeleteTarget(null);
								setSelectedId(null);
							}}
						>
							<Trash2 size={14} /> Remove
						</Button>
						<Button variant="outline" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
					</div>
				</Modal>
			)}
		</div>
	);
}

/** What a TAG move costs: TAG-admin roles and assignments in the old TAG, per program. */
function MoveWarning({ user, context }: { user: UserRow; context: UserContext | undefined }) {
	const lines: string[] = [];
	for (const r of user.roles) {
		if (r.role === "tag_admin" && r.tag_id === user.tag_id) {
			lines.push(`Loses ${programLabel(r.program as Program)} TAG admin`);
		}
	}
	const inOldTag = (a: AssignmentSummary) => a.tag_id === user.tag_id;
	for (const p of ["btech", "mtech"] as Program[]) {
		const t = programTerms(p);
		const guide = context?.guide.filter((a) => a.program === p && inOldTag(a)).length ?? 0;
		const panel = context?.panel.filter((a) => a.program === p && inOldTag(a)).length ?? 0;
		if (guide || panel) {
			lines.push(
				`Stays assigned in the old TAG (${programLabel(p)}): guide of ${guide} ${guide === 1 ? t.unitLower : t.unitsLower}, panel for ${panel}. Reassign them if needed.`,
			);
		}
	}
	if (lines.length === 0) return null;
	return (
		<ul className="users-warning">
			{lines.map((l) => (
				<li key={l}>{l}</li>
			))}
		</ul>
	);
}

function UserProfile({
	user,
	context,
	programs,
	tagName,
	isPending,
	onClose,
	onToggleRole,
	onPassword,
	onMove,
	onDelete,
}: {
	user: UserRow;
	context: UserContext;
	programs: Program[];
	tagName: (id: string | null) => string | null;
	isPending: boolean;
	onClose: () => void;
	onToggleRole: (r: AssignableRole, grant: boolean) => void;
	onPassword: () => void;
	onMove?: () => void;
	onDelete?: () => void;
}) {
	const access = useAccess();
	const isMe = user.id === access.userId;
	const assignable = isMe ? [] : assignableRoles(access.roles, access.tagId, user.tag_id);
	const canReset = canManageUser(access.roles, access.tagId, {
		roles: user.roles,
		tagId: user.tag_id,
	});
	const institutionRole = assignable.find((r) => r.role === "institution_admin");
	const isInstAdmin = hasRole(user.roles, "institution_admin");

	return (
		<div className="users-profile">
			<div className="users-profile-head">
				<span className="users-avatar is-large">{initialsOf(user.name, user.email)}</span>
				<div style={{ minWidth: 0, flex: 1 }}>
					<h2>{user.name || user.email}</h2>
					<p className="users-muted">{user.email}</p>
					<p className="users-profile-facts">
						<span className="users-chip">{user.tag_short_name ?? "No TAG"}</span>
						{isInstAdmin && (
							<span className="users-chip is-institution">
								<Building2 size={10} /> Institution Admin
							</span>
						)}
						<span className="users-muted">
							Joined {formatDate(user.created_at)} · Last sign-in {formatDate(user.last_sign_in_at)}
						</span>
					</p>
				</div>
				<button className="users-profile-close" onClick={onClose} aria-label="Close profile">
					<X size={18} />
				</button>
			</div>

			<div className="users-profile-actions">
				{canReset && (
					<Button
						size="sm"
						variant="outline"
						className="gap-2"
						onClick={onPassword}
						disabled={isPending}
					>
						<KeyRound size={13} /> Set password
					</Button>
				)}
				{onMove && (
					<Button
						size="sm"
						variant="outline"
						className="gap-2"
						onClick={onMove}
						disabled={isPending}
					>
						<ArrowRightLeft size={13} /> Move to TAG
					</Button>
				)}
				{access.isAdmin && (
					<Link href="/admin/assignments" className="users-link">
						<ClipboardList size={13} /> Assign to {programTerms(access.program).unitsLower}
					</Link>
				)}
				{onDelete && (
					<Button
						size="sm"
						variant="destructive"
						className="gap-2"
						onClick={onDelete}
						disabled={isPending}
					>
						<Trash2 size={13} /> Remove user
					</Button>
				)}
			</div>

			{institutionRole && (
				<RoleToggle
					role={institutionRole}
					active={isInstAdmin}
					disabled={isPending}
					onChange={(grant) => onToggleRole(institutionRole, grant)}
				/>
			)}

			<div className={`users-programs${programs.length > 1 ? " is-split" : ""}`}>
				{programs.map((p) => {
					const t = programTerms(p);
					const roles = assignable.filter((r) => r.program === p);
					const held = roleLabels(user.roles.filter((r) => r.program === p));
					const guide = context.guide.filter((a) => a.program === p);
					const panel = context.panel.filter((a) => a.program === p);
					return (
						<section key={p} className="users-program">
							<h3>
								<GraduationCap size={15} /> {programLabel(p)}
							</h3>

							<h4>Roles</h4>
							{roles.length > 0 ? (
								<div className="users-role-list">
									{roles.map((r) => (
										<RoleToggle
											key={`${r.role}:${r.program}`}
											role={r}
											active={hasRole(
												user.roles,
												r.role,
												r.program,
												r.role === "tag_admin" ? user.tag_id : undefined,
											)}
											disabled={isPending}
											onChange={(grant) => onToggleRole(r, grant)}
										/>
									))}
								</div>
							) : (
								<p className="users-muted">
									{held.length > 0 ? held.join(", ") : "Faculty"}
									{!isMe && !user.tag_id && " · put them in a TAG to make them TAG admin"}
								</p>
							)}

							<h4>Guide of</h4>
							<AssignmentList
								items={guide}
								empty={`No ${t.unitsLower}`}
								tagName={tagName}
								showApproval
							/>

							<h4>Panel for</h4>
							<AssignmentList items={panel} empty={`No ${t.unitsLower}`} tagName={tagName} />
						</section>
					);
				})}
			</div>
		</div>
	);
}

function RoleToggle({
	role,
	active,
	disabled,
	onChange,
}: {
	role: AssignableRole;
	active: boolean;
	disabled: boolean;
	onChange: (grant: boolean) => void;
}) {
	return (
		<label className={`users-role-toggle${active ? " is-active" : ""}`}>
			<input
				type="checkbox"
				checked={active}
				disabled={disabled}
				onChange={(e) => onChange(e.target.checked)}
			/>
			<span>
				<span className="users-role-name">{role.label}</span>
				<span className="users-role-desc">{role.description}</span>
			</span>
		</label>
	);
}

function AssignmentList({
	items,
	empty,
	tagName,
	showApproval,
}: {
	items: AssignmentSummary[];
	empty: string;
	tagName: (id: string | null) => string | null;
	showApproval?: boolean;
}) {
	if (items.length === 0) return <p className="users-muted">{empty}</p>;
	return (
		<ul className="users-assignments">
			{items.map((a) => (
				<li key={a.group_id}>
					<span className="users-assignment-name">{a.name}</span>
					{a.project_title && <span className="users-assignment-title">{a.project_title}</span>}
					<span className="users-assignment-meta">
						{tagName(a.tag_id) && <span className="users-chip">{tagName(a.tag_id)}</span>}
						{a.students} student{a.students === 1 ? "" : "s"}
						{showApproval &&
							(a.guide_approved ? (
								<span className="users-ok">
									<CheckCircle2 size={11} /> Approved
								</span>
							) : (
								<span className="users-pending">
									<Clock size={11} /> Pending
								</span>
							))}
					</span>
				</li>
			))}
		</ul>
	);
}
