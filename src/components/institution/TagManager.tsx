"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
	Building2,
	Users,
	ClipboardList,
	Plus,
	Pencil,
	Trash2,
	UserMinus,
	UserCheck,
	ArrowRight,
	X,
	Check,
	ChevronDown,
} from "lucide-react";
import type { Tag, Profile } from "@/types/database";
import {
	createTagAction,
	updateTagAction,
	deleteTagAction,
	assignMemberToTagAction,
	removeMemberFromTagAction,
	elevateToAdminAction,
	demoteToFacultyAction,
} from "@/app/actions/tags";

interface TagWithMembers extends Tag {
	members: Profile[];
	groupCount: number;
}

interface Props {
	tags: TagWithMembers[];
	allProfiles: Profile[];
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Initials({ name }: { name: string }) {
	const parts = name.trim().split(" ");
	const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: 32,
				height: 32,
				borderRadius: "50%",
				flexShrink: 0,
				background: "hsl(var(--primary) / 0.12)",
				color: "hsl(var(--primary))",
				fontSize: "0.7rem",
				fontWeight: 700,
				letterSpacing: "0.03em",
				border: "1px solid hsl(var(--primary) / 0.2)",
			}}
		>
			{letters.toUpperCase()}
		</span>
	);
}

function RoleBadge({ role }: { role: string }) {
	const isAdmin = role === "admin";
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				padding: "2px 8px",
				borderRadius: 999,
				fontSize: "0.67rem",
				fontWeight: 700,
				letterSpacing: "0.04em",
				background: isAdmin ? "hsl(var(--primary) / 0.1)" : "hsl(var(--muted))",
				color: isAdmin ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
				border: `1px solid ${isAdmin ? "hsl(var(--primary) / 0.2)" : "hsl(var(--border))"}`,
			}}
		>
			{isAdmin ? "Admin" : "Faculty"}
		</span>
	);
}

function Btn({
	children,
	onClick,
	disabled,
	variant = "ghost",
	size = "sm",
	danger = false,
}: {
	children: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	variant?: "ghost" | "outline" | "primary";
	size?: "sm" | "xs";
	danger?: boolean;
}) {
	const baseStyle: React.CSSProperties = {
		display: "inline-flex",
		alignItems: "center",
		gap: 5,
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.5 : 1,
		border: "none",
		background: "transparent",
		fontFamily: "inherit",
		transition: "all 0.15s",
		fontSize: size === "xs" ? "0.72rem" : "0.78rem",
		padding: size === "xs" ? "3px 8px" : "5px 10px",
		borderRadius: 6,
		fontWeight: 600,
	};
	const variantStyle: React.CSSProperties =
		variant === "primary"
			? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
			: variant === "outline"
				? {
						border: "1px solid hsl(var(--border))",
						background: "hsl(var(--card))",
						color: "hsl(var(--foreground))",
					}
				: { color: danger ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" };

	return (
		<button onClick={onClick} disabled={disabled} style={{ ...baseStyle, ...variantStyle }}>
			{children}
		</button>
	);
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
	member,
	currentTagId,
	otherTags,
	pending,
	onRemove,
	onElevate,
	onDemote,
	onMove,
}: {
	member: Profile;
	currentTagId: string;
	otherTags: Tag[];
	pending: boolean;
	onRemove: () => void;
	onElevate: () => void;
	onDemote: () => void;
	onMove: (targetTagId: string) => void;
}) {
	const [showMove, setShowMove] = useState(false);
	const [targetTagId, setTargetTagId] = useState("");
	const isAdmin = member.role === "admin";

	function handleMove() {
		if (!targetTagId) return;
		onMove(targetTagId);
		setShowMove(false);
		setTargetTagId("");
	}

	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 10,
				padding: "10px 12px",
				borderRadius: 8,
				background: "hsl(var(--muted) / 0.4)",
				border: "1px solid hsl(var(--border) / 0.5)",
				flexDirection: "column",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
				<Initials name={member.name} />
				<div style={{ flex: 1, minWidth: 0 }}>
					<p
						style={{
							margin: 0,
							fontSize: "0.83rem",
							fontWeight: 600,
							color: "var(--app-hero-text)",
							lineHeight: 1.3,
						}}
					>
						{member.name}
					</p>
					<p
						style={{
							margin: 0,
							fontSize: "0.72rem",
							color: "hsl(var(--muted-foreground))",
							lineHeight: 1.3,
						}}
					>
						{member.email}
					</p>
				</div>
				<RoleBadge role={member.role} />
				<div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
					{isAdmin ? (
						<Btn size="xs" onClick={onDemote} disabled={pending}>
							<UserMinus size={11} />
							Demote
						</Btn>
					) : (
						<Btn size="xs" onClick={onElevate} disabled={pending}>
							<UserCheck size={11} />
							Make Admin
						</Btn>
					)}
					{otherTags.length > 0 && (
						<Btn size="xs" onClick={() => setShowMove(!showMove)} disabled={pending}>
							<ArrowRight size={11} />
							Move
						</Btn>
					)}
					<Btn size="xs" danger onClick={onRemove} disabled={pending}>
						<UserMinus size={11} />
						Remove
					</Btn>
				</div>
			</div>

			{showMove && (
				<div
					style={{
						width: "100%",
						paddingLeft: 42,
						display: "flex",
						alignItems: "center",
						gap: 8,
						flexWrap: "wrap",
					}}
				>
					{isAdmin && (
						<span
							style={{ fontSize: "0.72rem", color: "hsl(var(--destructive))", fontWeight: 600 }}
						>
							⚠ Admin privileges will be revoked
						</span>
					)}
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<select
							value={targetTagId}
							onChange={(e) => setTargetTagId(e.target.value)}
							style={{
								padding: "4px 8px",
								borderRadius: 6,
								fontSize: "0.78rem",
								border: "1px solid hsl(var(--border))",
								background: "hsl(var(--background))",
								color: "hsl(var(--foreground))",
							}}
						>
							<option value="">Select TAG…</option>
							{otherTags.map((t) => (
								<option key={t.id} value={t.id}>
									{t.short_name} — {t.name}
								</option>
							))}
						</select>
						<Btn
							size="xs"
							variant="primary"
							onClick={handleMove}
							disabled={!targetTagId || pending}
						>
							<Check size={11} />
							Confirm
						</Btn>
						<Btn
							size="xs"
							onClick={() => {
								setShowMove(false);
								setTargetTagId("");
							}}
						>
							<X size={11} />
						</Btn>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Add member picker ─────────────────────────────────────────────────────────

function AddMemberPicker({
	tagId,
	currentMembers,
	allProfiles,
	pending,
	onAssign,
	onClose,
}: {
	tagId: string;
	currentMembers: Profile[];
	allProfiles: Profile[];
	pending: boolean;
	onAssign: (profileId: string) => void;
	onClose: () => void;
}) {
	const [search, setSearch] = useState("");
	const currentIds = new Set(currentMembers.map((m) => m.id));

	const candidates = useMemo(() => {
		const q = search.toLowerCase();
		return allProfiles
			.filter((p) => p.role !== "institution_admin" && !currentIds.has(p.id))
			.filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
			.slice(0, 30);
	}, [allProfiles, search, currentIds]);

	return (
		<div
			style={{
				marginTop: 8,
				padding: 12,
				background: "hsl(var(--card))",
				border: "1px solid hsl(var(--border))",
				borderRadius: 10,
				boxShadow: "var(--shadow-md)",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 8,
				}}
			>
				<p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600 }}>Add member</p>
				<button
					onClick={onClose}
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						color: "hsl(var(--muted-foreground))",
						padding: 2,
					}}
				>
					<X size={14} />
				</button>
			</div>
			<input
				autoFocus
				placeholder="Search by name or email…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				style={{
					width: "100%",
					padding: "6px 10px",
					borderRadius: 6,
					fontSize: "0.83rem",
					border: "1px solid hsl(var(--border))",
					background: "hsl(var(--background))",
					color: "hsl(var(--foreground))",
					marginBottom: 8,
					boxSizing: "border-box",
				}}
			/>
			<div
				style={{
					maxHeight: 220,
					overflowY: "auto",
					display: "flex",
					flexDirection: "column",
					gap: 4,
				}}
			>
				{candidates.length === 0 && (
					<p
						style={{
							margin: 0,
							fontSize: "0.78rem",
							color: "hsl(var(--muted-foreground))",
							textAlign: "center",
							padding: "12px 0",
						}}
					>
						No members found
					</p>
				)}
				{candidates.map((p) => {
					const fromOtherTag = p.tag_id && p.tag_id !== tagId;
					return (
						<button
							key={p.id}
							disabled={pending}
							onClick={() => onAssign(p.id)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: "7px 10px",
								background: "hsl(var(--muted) / 0.4)",
								border: "1px solid transparent",
								borderRadius: 7,
								cursor: pending ? "not-allowed" : "pointer",
								textAlign: "left",
								opacity: pending ? 0.6 : 1,
								width: "100%",
								fontFamily: "inherit",
							}}
						>
							<Initials name={p.name} />
							<div style={{ flex: 1, minWidth: 0 }}>
								<p
									style={{
										margin: 0,
										fontSize: "0.8rem",
										fontWeight: 600,
										color: "var(--app-hero-text)",
									}}
								>
									{p.name}
								</p>
								<p style={{ margin: 0, fontSize: "0.7rem", color: "hsl(var(--muted-foreground))" }}>
									{p.email}
								</p>
							</div>
							{fromOtherTag && (
								<span
									style={{
										fontSize: "0.67rem",
										color: "hsl(var(--destructive))",
										fontWeight: 600,
										flexShrink: 0,
									}}
								>
									⚠ will move
								</span>
							)}
							{p.role === "admin" && (
								<span
									style={{
										fontSize: "0.67rem",
										color: "hsl(var(--destructive))",
										fontWeight: 600,
										flexShrink: 0,
									}}
								>
									loses admin
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

// ── TAG card ──────────────────────────────────────────────────────────────────

function TagCard({
	tag,
	allTags,
	allProfiles,
	pending,
	run,
}: {
	tag: TagWithMembers;
	allTags: Tag[];
	allProfiles: Profile[];
	pending: boolean;
	run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(tag.name);
	const [editShort, setEditShort] = useState(tag.short_name);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [showAddMember, setShowAddMember] = useState(false);

	const otherTags = allTags.filter((t) => t.id !== tag.id);

	async function handleSaveEdit() {
		if (!editName.trim() || !editShort.trim()) return;
		await run(() => updateTagAction(tag.id, editName, editShort));
		setEditing(false);
	}

	async function handleDelete() {
		await run(() => deleteTagAction(tag.id));
		setConfirmDelete(false);
	}

	async function handleAssign(profileId: string) {
		await run(() => assignMemberToTagAction(profileId, tag.id));
		setShowAddMember(false);
	}

	async function handleRemove(profileId: string) {
		await run(() => removeMemberFromTagAction(profileId));
	}

	async function handleElevate(profileId: string) {
		await run(() => elevateToAdminAction(profileId));
	}

	async function handleDemote(profileId: string) {
		await run(() => demoteToFacultyAction(profileId));
	}

	async function handleMove(profileId: string, targetTagId: string) {
		await run(() => assignMemberToTagAction(profileId, targetTagId));
	}

	return (
		<div
			style={{
				background: "hsl(var(--card))",
				border: "1px solid hsl(var(--border))",
				borderRadius: "calc(var(--radius) * 1.5)",
				boxShadow: "var(--shadow-md)",
				overflow: "hidden",
			}}
		>
			{/* Header */}
			<div style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border) / 0.5)" }}>
				{editing ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
						<div style={{ display: "flex", gap: 8 }}>
							<input
								value={editShort}
								onChange={(e) => setEditShort(e.target.value.toUpperCase())}
								placeholder="SHORT"
								maxLength={10}
								style={{
									width: 90,
									padding: "6px 10px",
									borderRadius: 6,
									fontSize: "0.83rem",
									fontWeight: 700,
									border: "1px solid hsl(var(--border))",
									background: "hsl(var(--background))",
									color: "hsl(var(--foreground))",
								}}
							/>
							<input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								placeholder="Full TAG name"
								style={{
									flex: 1,
									padding: "6px 10px",
									borderRadius: 6,
									fontSize: "0.83rem",
									border: "1px solid hsl(var(--border))",
									background: "hsl(var(--background))",
									color: "hsl(var(--foreground))",
								}}
							/>
						</div>
						<div style={{ display: "flex", gap: 6 }}>
							<Btn
								size="xs"
								variant="primary"
								onClick={handleSaveEdit}
								disabled={pending || !editName.trim() || !editShort.trim()}
							>
								<Check size={11} />
								Save
							</Btn>
							<Btn
								size="xs"
								onClick={() => {
									setEditing(false);
									setEditName(tag.name);
									setEditShort(tag.short_name);
								}}
							>
								Cancel
							</Btn>
						</div>
					</div>
				) : (
					<div
						style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
					>
						<div>
							<span
								style={{
									display: "inline-block",
									padding: "3px 10px",
									borderRadius: 999,
									fontSize: "0.7rem",
									fontWeight: 800,
									letterSpacing: "0.05em",
									background: "hsl(var(--primary) / 0.1)",
									color: "hsl(var(--primary))",
									border: "1px solid hsl(var(--primary) / 0.2)",
									marginBottom: 6,
								}}
							>
								{tag.short_name}
							</span>
							<p
								style={{
									margin: 0,
									fontSize: "0.9rem",
									fontWeight: 600,
									color: "var(--app-hero-text)",
								}}
							>
								{tag.name}
							</p>
							<p
								style={{
									margin: 0,
									marginTop: 3,
									fontSize: "0.72rem",
									color: "hsl(var(--muted-foreground))",
								}}
							>
								{tag.members.length} member{tag.members.length !== 1 ? "s" : ""} · {tag.groupCount}{" "}
								group{tag.groupCount !== 1 ? "s" : ""}
							</p>
						</div>
						<div style={{ display: "flex", gap: 2 }}>
							<Btn
								size="xs"
								variant="outline"
								onClick={() => {
									setEditing(true);
									setEditName(tag.name);
									setEditShort(tag.short_name);
								}}
								disabled={pending}
							>
								<Pencil size={11} />
								Edit
							</Btn>
							{!confirmDelete ? (
								<Btn size="xs" danger onClick={() => setConfirmDelete(true)} disabled={pending}>
									<Trash2 size={11} />
									Delete
								</Btn>
							) : (
								<span style={{ display: "flex", alignItems: "center", gap: 5 }}>
									<span
										style={{
											fontSize: "0.72rem",
											color: "hsl(var(--destructive))",
											fontWeight: 600,
										}}
									>
										Sure?
									</span>
									<Btn size="xs" danger onClick={handleDelete} disabled={pending}>
										<Check size={11} />
										Yes
									</Btn>
									<Btn size="xs" onClick={() => setConfirmDelete(false)}>
										<X size={11} />
										No
									</Btn>
								</span>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Members */}
			<div style={{ padding: "12px 20px 16px" }}>
				{tag.members.length > 0 ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						{tag.members.map((member) => (
							<MemberRow
								key={member.id}
								member={member}
								currentTagId={tag.id}
								otherTags={otherTags}
								pending={pending}
								onRemove={() => handleRemove(member.id)}
								onElevate={() => handleElevate(member.id)}
								onDemote={() => handleDemote(member.id)}
								onMove={(targetTagId) => handleMove(member.id, targetTagId)}
							/>
						))}
					</div>
				) : (
					<p
						style={{
							margin: 0,
							fontSize: "0.78rem",
							color: "hsl(var(--muted-foreground))",
							fontStyle: "italic",
						}}
					>
						No members assigned yet.
					</p>
				)}

				<div style={{ marginTop: 10 }}>
					{showAddMember ? (
						<AddMemberPicker
							tagId={tag.id}
							currentMembers={tag.members}
							allProfiles={allProfiles}
							pending={pending}
							onAssign={handleAssign}
							onClose={() => setShowAddMember(false)}
						/>
					) : (
						<Btn
							size="xs"
							variant="outline"
							onClick={() => setShowAddMember(true)}
							disabled={pending}
						>
							<Plus size={11} />
							Add member
						</Btn>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TagManager({ tags: initialTags, allProfiles: initialProfiles }: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [acting, setActing] = useState(false);

	// Create TAG form
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newShort, setNewShort] = useState("");

	const unassigned = initialProfiles.filter((p) => !p.tag_id && p.role !== "institution_admin");

	const [assignToTagId, setAssignToTagId] = useState<Record<string, string>>({});

	function refresh() {
		startTransition(() => {
			router.refresh();
		});
	}

	async function run(fn: () => Promise<unknown>) {
		setActing(true);
		await fn();
		setActing(false);
		refresh();
	}

	async function handleCreate() {
		if (!newName.trim() || !newShort.trim()) return;
		await run(() => createTagAction(newName, newShort));
		setNewName("");
		setNewShort("");
		setShowCreate(false);
	}

	async function handleAssignUnassigned(profileId: string) {
		const tagId = assignToTagId[profileId];
		if (!tagId) return;
		await run(() => assignMemberToTagAction(profileId, tagId));
		setAssignToTagId((prev) => {
			const next = { ...prev };
			delete next[profileId];
			return next;
		});
	}

	const totals = {
		tags: initialTags.length,
		members: initialProfiles.filter((p) => p.tag_id).length,
		unassigned: unassigned.length,
		groups: initialTags.reduce((sum, t) => sum + t.groupCount, 0),
	};

	return (
		<div style={{ padding: "0 0 48px" }}>
			{/* Page header */}
			<div
				className="dashboard-topbar"
				style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
			>
				<div>
					<p className="eyebrow">Institution Admin</p>
					<h1 className="section-title" style={{ marginTop: 6 }}>
						All TAGs
					</h1>
					<p className="section-subtitle">
						Create and manage Technology Advancement Groups and their members
					</p>
				</div>
				<button
					onClick={() => setShowCreate(!showCreate)}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						marginTop: 8,
						padding: "8px 14px",
						borderRadius: 8,
						cursor: "pointer",
						background: "hsl(var(--primary))",
						color: "hsl(var(--primary-foreground))",
						border: "none",
						fontFamily: "inherit",
						fontSize: "0.83rem",
						fontWeight: 600,
					}}
				>
					<Plus size={14} />
					New TAG
				</button>
			</div>

			{/* Create form */}
			{showCreate && (
				<div className="dashboard-section" style={{ paddingTop: 0 }}>
					<div
						style={{
							padding: 20,
							background: "hsl(var(--card))",
							border: "1px solid hsl(var(--border))",
							borderRadius: 12,
							boxShadow: "var(--shadow-md)",
							maxWidth: 520,
						}}
					>
						<p style={{ margin: "0 0 12px", fontSize: "0.88rem", fontWeight: 700 }}>
							Create new TAG
						</p>
						<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
							<input
								value={newShort}
								onChange={(e) => setNewShort(e.target.value.toUpperCase())}
								placeholder="Short name (e.g. CSE)"
								maxLength={10}
								style={{
									width: 140,
									padding: "7px 10px",
									borderRadius: 7,
									fontSize: "0.83rem",
									fontWeight: 700,
									border: "1px solid hsl(var(--border))",
									background: "hsl(var(--background))",
									color: "hsl(var(--foreground))",
								}}
							/>
							<input
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="Full name (e.g. Computer Science Engineering)"
								style={{
									flex: 1,
									padding: "7px 10px",
									borderRadius: 7,
									fontSize: "0.83rem",
									border: "1px solid hsl(var(--border))",
									background: "hsl(var(--background))",
									color: "hsl(var(--foreground))",
								}}
							/>
						</div>
						<div style={{ display: "flex", gap: 8 }}>
							<Btn
								variant="primary"
								onClick={handleCreate}
								disabled={isPending || !newName.trim() || !newShort.trim()}
							>
								<Check size={13} />
								Create TAG
							</Btn>
							<Btn
								onClick={() => {
									setShowCreate(false);
									setNewName("");
									setNewShort("");
								}}
							>
								Cancel
							</Btn>
						</div>
					</div>
				</div>
			)}

			{/* Stats */}
			<div className="dashboard-section">
				<p className="eyebrow">At a glance</p>
				<div className="stat-grid">
					{[
						{ icon: <Building2 size={18} />, value: totals.tags, label: "TAGs" },
						{ icon: <Users size={18} />, value: totals.members, label: "Assigned members" },
						{ icon: <ClipboardList size={18} />, value: totals.groups, label: "Groups" },
						{ icon: <Users size={18} />, value: totals.unassigned, label: "Unassigned" },
					].map(({ icon, value, label }) => (
						<div key={label} className="stat-card">
							<div className="stat-icon">{icon}</div>
							<span className="stat-value">{value}</span>
							<span className="stat-label">{label}</span>
						</div>
					))}
				</div>
			</div>

			{/* TAG cards */}
			<div className="dashboard-section">
				<p className="eyebrow">TAG management</p>
				{initialTags.length === 0 ? (
					<div
						style={{
							padding: "48px 24px",
							textAlign: "center",
							background: "hsl(var(--card))",
							border: "1px dashed hsl(var(--border))",
							borderRadius: 12,
							marginTop: 12,
						}}
					>
						<Building2
							size={32}
							style={{ color: "hsl(var(--muted-foreground))", margin: "0 auto 12px" }}
						/>
						<p style={{ margin: 0, fontSize: "0.9rem", color: "hsl(var(--muted-foreground))" }}>
							No TAGs yet. Create one above.
						</p>
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
						{initialTags.map((tag) => (
							<TagCard
								key={tag.id}
								tag={tag}
								allTags={initialTags}
								allProfiles={initialProfiles}
								pending={isPending || acting}
								run={run}
							/>
						))}
					</div>
				)}
			</div>

			{/* Unassigned members */}
			{unassigned.length > 0 && (
				<div className="dashboard-section">
					<p className="eyebrow">Unassigned members</p>
					<p
						style={{
							fontSize: "0.8rem",
							color: "hsl(var(--muted-foreground))",
							marginTop: 2,
							marginBottom: 12,
						}}
					>
						These faculty have no TAG yet. Assign them using the dropdown.
					</p>
					<div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 680 }}>
						{unassigned.map((p) => (
							<div
								key={p.id}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 10,
									padding: "10px 14px",
									background: "hsl(var(--card))",
									border: "1px solid hsl(var(--border))",
									borderRadius: 10,
									boxShadow: "var(--shadow-sm)",
								}}
							>
								<Initials name={p.name} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<p
										style={{
											margin: 0,
											fontSize: "0.83rem",
											fontWeight: 600,
											color: "var(--app-hero-text)",
										}}
									>
										{p.name}
									</p>
									<p
										style={{
											margin: 0,
											fontSize: "0.72rem",
											color: "hsl(var(--muted-foreground))",
										}}
									>
										{p.email}
									</p>
								</div>
								<div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
									<select
										value={assignToTagId[p.id] ?? ""}
										onChange={(e) =>
											setAssignToTagId((prev) => ({ ...prev, [p.id]: e.target.value }))
										}
										style={{
											padding: "5px 8px",
											borderRadius: 6,
											fontSize: "0.78rem",
											border: "1px solid hsl(var(--border))",
											background: "hsl(var(--background))",
											color: "hsl(var(--foreground))",
										}}
									>
										<option value="">Assign to…</option>
										{initialTags.map((t) => (
											<option key={t.id} value={t.id}>
												{t.short_name} — {t.name}
											</option>
										))}
									</select>
									<Btn
										size="xs"
										variant="primary"
										disabled={!assignToTagId[p.id] || isPending}
										onClick={() => handleAssignUnassigned(p.id)}
									>
										<ChevronDown size={11} />
										Assign
									</Btn>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
