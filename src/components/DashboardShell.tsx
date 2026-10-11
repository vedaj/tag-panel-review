"use client";
import { useState, useEffect } from "react";
import type { Profile, Program, Tag } from "@/types/database";
import type { AdminScope } from "@/app/actions/scope";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ProgramProvider } from "./ProgramContext";

export function DashboardShell({
	profile,
	tags,
	adminScope,
	program,
	children,
}: {
	profile: Profile | null;
	tags: Tag[];
	adminScope: AdminScope;
	program: Program;
	children: React.ReactNode;
}) {
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [mobileOpen, setMobileOpen] = useState(false);

	useEffect(() => {
		try {
			const v = localStorage.getItem("tag:sidebar-open");
			if (v !== null) setSidebarOpen(v !== "false");
		} catch {}
	}, []);

	function toggleDesktop() {
		setSidebarOpen((prev) => {
			const next = !prev;
			try {
				localStorage.setItem("tag:sidebar-open", String(next));
			} catch {}
			return next;
		});
	}

	return (
		<div
			className="app-shell"
			style={{ gridTemplateColumns: `${sidebarOpen ? "264px" : "72px"} minmax(0, 1fr)` }}
		>
			<Sidebar
				profile={profile}
				open={sidebarOpen}
				mobileOpen={mobileOpen}
				onMobileToggle={() => setMobileOpen((v) => !v)}
				onMobileClose={() => setMobileOpen(false)}
				adminScope={adminScope}
			/>
			<div className="content-column">
				<TopBar
					profile={profile}
					tags={tags}
					adminScope={adminScope}
					program={program}
					sidebarOpen={sidebarOpen}
					onDesktopToggle={toggleDesktop}
					onMobileToggle={() => setMobileOpen((v) => !v)}
				/>
				<div className="page-content">
					<ProgramProvider program={program}>{children}</ProgramProvider>
				</div>
			</div>
		</div>
	);
}
