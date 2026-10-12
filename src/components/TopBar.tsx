"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
	PanelLeftClose,
	PanelLeftOpen,
	Menu,
	LogOut,
	GraduationCap,
	Sun,
	Moon,
	Building2,
	Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { setActingRole } from "@/app/actions/acting";
import { setProgram } from "@/app/actions/program";
import { PROGRAMS } from "@/lib/programs";
import type { Profile, Program, Tag as TagType } from "@/types/database";
import { actingLabel, type Access, type ActingRole } from "@/lib/roles";

type Theme = "light" | "dark";
type FontMode = "serif" | "sans";

export function TopBar({
	profile,
	tags,
	program,
	access,
	sidebarOpen,
	onDesktopToggle,
	onMobileToggle,
}: {
	profile: Profile | null;
	tags: TagType[];
	program: Program;
	access: Access;
	sidebarOpen: boolean;
	onDesktopToggle: () => void;
	onMobileToggle: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [theme, setTheme] = useState<Theme>("light");
	const [fontMode, setFontMode] = useState<FontMode>("serif");
	const [activeProgram, setActiveProgram] = useState<Program>(program);
	const [switchingProgram, startProgramTransition] = useTransition();
	const [switchingRole, startRoleTransition] = useTransition();
	const menuRef = useRef<HTMLDivElement>(null);
	const router = useRouter();
	const supabase = createClient();

	const homeTag = tags.find((t) => t.id === profile?.tag_id);

	function optionLabel(role: ActingRole) {
		const label = actingLabel(role, program);
		return role === "tag" && homeTag ? `${label} · ${homeTag.short_name}` : label;
	}

	useEffect(() => {
		try {
			const t = localStorage.getItem("tag:theme") as Theme | null;
			const f = localStorage.getItem("tag:font") as FontMode | null;
			if (t) setTheme(t);
			if (f) setFontMode(f);
		} catch {}
	}, []);

	useEffect(() => {
		setActiveProgram(program);
	}, [program]);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	function applyTheme(t: Theme) {
		setTheme(t);
		try {
			localStorage.setItem("tag:theme", t);
		} catch {}
		document.documentElement.classList.toggle("dark", t === "dark");
	}

	function applyFont(f: FontMode) {
		setFontMode(f);
		try {
			localStorage.setItem("tag:font", f);
		} catch {}
		document.documentElement.classList.toggle("font-sans-ui", f === "sans");
	}

	function applyActing(role: ActingRole) {
		startRoleTransition(async () => {
			await setActingRole(role);
			router.refresh();
		});
	}

	function applyProgram(p: Program) {
		if (p === activeProgram) return;
		setActiveProgram(p);
		startProgramTransition(async () => {
			await setProgram(p);
			router.refresh();
		});
	}

	async function handleSignOut() {
		setMenuOpen(false);
		await supabase.auth.signOut();
		router.push("/login");
		router.refresh();
	}

	const initials = profile?.name
		? profile.name
				.split(" ")
				.map((w) => w[0])
				.slice(0, 2)
				.join("")
				.toUpperCase()
		: "?";

	return (
		<div className="content-topbar">
			{/* Mobile: open drawer */}
			<button className="topbar-icon-btn mobile-only" onClick={onMobileToggle} title="Open menu">
				<Menu size={18} />
			</button>

			{/* Mobile: brand */}
			<div className="topbar-brand mobile-only">
				<span className="topbar-brand-icon">
					<GraduationCap size={15} />
				</span>
				<span className="topbar-brand-name">TAG Panel Review</span>
			</div>

			{/* Desktop: sidebar collapse toggle */}
			<button
				className="topbar-icon-btn desktop-only"
				onClick={onDesktopToggle}
				title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
			>
				{sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
			</button>

			{/* TAG context badge */}
			{profile?.tag && (
				<div className="topbar-tag-badge desktop-only">
					{access.tagFilter === null ? (
						<>
							<Building2 size={12} />
							<span>{access.isInstitutionAdmin ? "Institution" : "All TAGs"}</span>
						</>
					) : (
						<>
							<Tag size={12} />
							<span>{profile.tag.short_name}</span>
						</>
					)}
				</div>
			)}

			{/* B.Tech / M.Tech switch */}
			<div
				className="program-switch"
				role="group"
				aria-label="Program"
				aria-busy={switchingProgram}
			>
				{PROGRAMS.map(({ value, label, description }) => (
					<button
						key={value}
						type="button"
						className={`program-switch-btn${activeProgram === value ? " is-active" : ""}`}
						aria-pressed={activeProgram === value}
						title={`${label}: ${description}`}
						disabled={switchingProgram}
						onClick={() => applyProgram(value)}
					>
						{label}
					</button>
				))}
			</div>

			{/* Which of their roles the user is acting as */}
			{access.actingOptions.length > 1 && (
				<label className="acting-switch" title="Show the app as one of your roles">
					<span className="acting-switch-label desktop-only">Acting as</span>
					<select
						value={access.acting}
						disabled={switchingRole}
						onChange={(e) => applyActing(e.target.value as ActingRole)}
						aria-label="Acting as"
					>
						{access.actingOptions.map((role) => (
							<option key={role} value={role}>
								{optionLabel(role)}
							</option>
						))}
					</select>
				</label>
			)}

			{/* User menu — always visible */}
			<div style={{ position: "relative", marginLeft: "auto" }} ref={menuRef}>
				<button className="user-menu-pill" onClick={() => setMenuOpen((v) => !v)}>
					<span className="user-avatar-ring">
						<span className="user-avatar-initials">{initials}</span>
					</span>
					<span className="user-menu-info desktop-only">
						<span className="user-menu-name">{profile?.name ?? "Faculty"}</span>
						<span className="user-menu-role">{access.roleLabel}</span>
					</span>
				</button>

				{menuOpen && (
					<div className="user-menu-dropdown">
						{/* Profile header */}
						<div className="user-menu-header">
							<span className="user-avatar-ring user-avatar-ring-lg">
								<span className="user-avatar-initials user-avatar-initials-lg">{initials}</span>
							</span>
							<div style={{ minWidth: 0 }}>
								<p className="user-menu-fullname">{profile?.name}</p>
								<p className="user-menu-badge">
									{access.roleLabel}
									{profile?.tag && (
										<span style={{ opacity: 0.7 }}> · {profile.tag.short_name}</span>
									)}
								</p>
							</div>
						</div>

						<div className="user-menu-divider" />

						{/* Preferences */}
						<div className="user-menu-pref-section">
							{/* Theme */}
							<div className="user-menu-pref-row">
								<span className="user-menu-pref-label">Theme</span>
								<div className="user-menu-pref-control">
									<button
										className={`pref-btn${theme === "light" ? " pref-btn-active" : ""}`}
										onClick={() => applyTheme("light")}
										title="Light"
									>
										<Sun size={13} />
									</button>
									<button
										className={`pref-btn${theme === "dark" ? " pref-btn-active" : ""}`}
										onClick={() => applyTheme("dark")}
										title="Dark"
									>
										<Moon size={13} />
									</button>
								</div>
							</div>

							{/* Font */}
							<div className="user-menu-pref-row">
								<span className="user-menu-pref-label">Font</span>
								<div className="user-menu-pref-control">
									<button
										className={`pref-btn pref-btn-serif${fontMode === "serif" ? " pref-btn-active" : ""}`}
										onClick={() => applyFont("serif")}
										title="Serif"
									>
										Aa
									</button>
									<button
										className={`pref-btn pref-btn-sans${fontMode === "sans" ? " pref-btn-active" : ""}`}
										onClick={() => applyFont("sans")}
										title="Sans-serif"
									>
										Aa
									</button>
								</div>
							</div>
						</div>

						<div className="user-menu-divider" />

						{/* Sign out */}
						<div className="user-menu-actions">
							<button className="user-menu-item" onClick={handleSignOut}>
								<LogOut size={14} />
								Sign out
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
