"use client";

import { useState } from "react";
import Link from "next/link";
import type {
	Group,
	Student,
	Criteria,
	Grade,
	Profile,
	Review,
	GroupReviewStatus,
} from "@/types/database";
import {
	BarChart2,
	TrendingUp,
	Users,
	ShieldCheck,
	Target,
	Award,
	Activity,
	ChevronRight,
	CheckCircle2,
	Clock,
	ArrowLeft,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface Props {
	isAdmin: boolean;
	facultyId: string;
	facultyName: string;
	groups: Group[];
	students: Student[];
	criteria: Criteria[]; // panel criteria for selected review
	guideCriteria: Criteria[]; // guide criteria for selected review
	myGrades: Grade[];
	allGrades: Grade[]; // all grades (guide+panel) for selected review
	profiles: Profile[];
	reviews: Pick<Review, "id" | "name" | "order_index">[];
	selectedReviewId: string | null;
	groupReviewStatuses: GroupReviewStatus[];
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function pctColor(pct: number): string {
	if (pct >= 75) return "#16a34a";
	if (pct >= 50) return "#ca8a04";
	return "#dc2626";
}
function pctBg(pct: number): string {
	if (pct >= 75) return "#dcfce7";
	if (pct >= 50) return "#fef9c3";
	return "#fee2e2";
}
function typeColor(pt: string) {
	if (pt === "research") return { bg: "#ede9fe", tx: "#5b21b6" };
	if (pt === "application") return { bg: "#dcfce7", tx: "#15803d" };
	return { bg: "#dbeafe", tx: "#1d4ed8" };
}
function capitalize(s: string) {
	return s ? s[0].toUpperCase() + s.slice(1) : "";
}

// ── Computation helpers ───────────────────────────────────────────────────────

function critMaxForGroup(group: Group, allCriteria: Criteria[]): number {
	const pt = group.project_type;
	if (!pt) return 0;
	return allCriteria
		.filter((c) => c.project_type === pt || c.project_type === "all")
		.reduce((s, c) => s + c.max_marks, 0);
}

function studentScoreByFaculty(
	studentId: string,
	group: Group,
	allCriteria: Criteria[],
	grades: Grade[],
	facultyId: string,
): number {
	const pt = group.project_type;
	if (!pt) return 0;
	const relevantCriteria = allCriteria.filter(
		(c) => c.project_type === pt || c.project_type === "all",
	);
	let total = 0;
	for (const crit of relevantCriteria) {
		if (crit.sub_criteria && crit.sub_criteria.length > 0) {
			for (const sub of crit.sub_criteria) {
				const g = grades.find(
					(r) =>
						r.faculty_id === facultyId &&
						r.student_id === studentId &&
						r.criteria_id === crit.id &&
						r.sub_criteria_id === sub.id,
				);
				total += g?.marks ?? 0;
			}
		} else {
			const g = grades.find(
				(r) =>
					r.faculty_id === facultyId &&
					r.student_id === studentId &&
					r.criteria_id === crit.id &&
					r.sub_criteria_id === null,
			);
			total += g?.marks ?? 0;
		}
	}
	return total;
}

function studentMeanScore(
	studentId: string,
	group: Group,
	allCriteria: Criteria[],
	grades: Grade[],
): number {
	const pt = group.project_type;
	if (!pt) return 0;
	const relevantCriteria = allCriteria.filter(
		(c) => c.project_type === pt || c.project_type === "all",
	);
	const facultyIds = [
		...new Set(grades.filter((g) => g.student_id === studentId).map((g) => g.faculty_id)),
	];
	if (facultyIds.length === 0) return 0;
	const totals = facultyIds.map((fid) => {
		let total = 0;
		for (const crit of relevantCriteria) {
			if (crit.sub_criteria && crit.sub_criteria.length > 0) {
				for (const sub of crit.sub_criteria) {
					const g = grades.find(
						(r) =>
							r.faculty_id === fid &&
							r.student_id === studentId &&
							r.criteria_id === crit.id &&
							r.sub_criteria_id === sub.id,
					);
					total += g?.marks ?? 0;
				}
			} else {
				const g = grades.find(
					(r) =>
						r.faculty_id === fid &&
						r.student_id === studentId &&
						r.criteria_id === crit.id &&
						r.sub_criteria_id === null,
				);
				total += g?.marks ?? 0;
			}
		}
		return total;
	});
	return totals.reduce((a, b) => a + b, 0) / totals.length;
}

function bucketize(pcts: number[]): number[] {
	const bins = Array(10).fill(0);
	for (const p of pcts) {
		const idx = Math.min(Math.floor(p / 10), 9);
		bins[idx]++;
	}
	return bins;
}

// ── Review analytics helpers ──────────────────────────────────────────────────

function critMax(crits: Criteria[]): number {
	return crits.reduce((sum, c) => {
		if (c.sub_criteria?.length) return sum + c.sub_criteria.reduce((s, sc) => s + sc.max_marks, 0);
		return sum + c.max_marks;
	}, 0);
}

function raterStudentScore(
	studentId: string,
	facultyId: string,
	grades: Grade[],
	crits: Criteria[],
): number {
	let total = 0;
	for (const crit of crits) {
		if (crit.sub_criteria?.length) {
			for (const sub of crit.sub_criteria) {
				total +=
					grades.find(
						(g) =>
							g.faculty_id === facultyId &&
							g.student_id === studentId &&
							g.criteria_id === crit.id &&
							g.sub_criteria_id === sub.id,
					)?.marks ?? 0;
			}
		} else {
			total +=
				grades.find(
					(g) =>
						g.faculty_id === facultyId &&
						g.student_id === studentId &&
						g.criteria_id === crit.id &&
						g.sub_criteria_id === null,
				)?.marks ?? 0;
		}
	}
	return total;
}

function studentAvgPct(studentId: string, grades: Grade[], crits: Criteria[], max: number): number {
	const raterIds = [
		...new Set(
			grades
				.filter((g) => g.student_id === studentId && crits.some((c) => c.id === g.criteria_id))
				.map((g) => g.faculty_id),
		),
	];
	if (!raterIds.length || max === 0) return 0;
	const totals = raterIds.map((fid) => raterStudentScore(studentId, fid, grades, crits));
	return (totals.reduce((a, b) => a + b, 0) / totals.length / max) * 100;
}

// Per-criteria average pct across all students and raters
function critAvgPct(
	criteriaId: string,
	grades: Grade[],
	maxMarks: number,
	subCriteriaId: string | null = null,
): number {
	const filtered = grades.filter(
		(g) =>
			g.criteria_id === criteriaId &&
			(subCriteriaId === null ? g.sub_criteria_id === null : g.sub_criteria_id === subCriteriaId),
	);
	if (!filtered.length || maxMarks === 0) return 0;
	return (filtered.reduce((a, g) => a + g.marks, 0) / filtered.length / maxMarks) * 100;
}

// ── Primitive chart components ────────────────────────────────────────────────

function HBar({ pct, color, bg }: { pct: number; color: string; bg?: string }) {
	return (
		<div
			style={{
				flex: 1,
				height: 10,
				borderRadius: 6,
				background: bg ?? "#e5e7eb",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					width: `${Math.max(pct, 0)}%`,
					height: "100%",
					background: color,
					borderRadius: 6,
					transition: "width 0.4s ease",
				}}
			/>
		</div>
	);
}

const BUCKET_LABELS = [
	"0–10",
	"10–20",
	"20–30",
	"30–40",
	"40–50",
	"50–60",
	"60–70",
	"70–80",
	"80–90",
	"90–100",
];

function Histogram({ bins }: { bins: number[] }) {
	const data = bins.map((count, i) => ({
		label: `${i * 10}`,
		fullLabel: BUCKET_LABELS[i],
		count,
		color: (i + 1) * 10 > 75 ? "#16a34a" : (i + 1) * 10 > 50 ? "#ca8a04" : "#dc2626",
	}));

	return (
		<ResponsiveContainer width="100%" height={140}>
			<BarChart data={data} barSize={22} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
				<XAxis
					dataKey="label"
					tick={{ fontSize: 10, fill: "#9ca3af" }}
					axisLine={false}
					tickLine={false}
				/>
				<YAxis
					allowDecimals={false}
					tick={{ fontSize: 10, fill: "#9ca3af" }}
					axisLine={false}
					tickLine={false}
				/>
				<Tooltip
					cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
					content={({ active, payload }) => {
						if (!active || !payload?.length) return null;
						const d = payload[0].payload as (typeof data)[0];
						return (
							<div
								style={{
									background: "hsl(var(--card))",
									border: "1px solid hsl(var(--border))",
									borderRadius: 8,
									padding: "6px 10px",
									fontSize: "0.78rem",
								}}
							>
								<p style={{ margin: 0, fontWeight: 600 }}>{d.fullLabel}%</p>
								<p style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}>
									{d.count} student{d.count !== 1 ? "s" : ""}
								</p>
							</div>
						);
					}}
				/>
				<Bar dataKey="count" radius={[4, 4, 0, 0]}>
					{data.map((entry, i) => (
						<Cell key={i} fill={entry.count > 0 ? entry.color : "#e5e7eb"} />
					))}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
	title,
	icon: Icon,
	children,
	adminOnly,
}: {
	title: string;
	icon: React.ElementType;
	children: React.ReactNode;
	adminOnly?: boolean;
}) {
	return (
		<div
			style={{
				border: `1px solid ${adminOnly ? "hsl(270 60% 88%)" : "hsl(var(--border))"}`,
				borderRadius: "calc(var(--radius) * 1.6)",
				overflow: "hidden",
				background: "hsl(var(--card))",
				boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "12px 16px",
					borderBottom: `1px solid ${adminOnly ? "hsl(270 60% 92%)" : "hsl(var(--border))"}`,
					background: adminOnly ? "hsl(270 60% 97%)" : "hsl(var(--muted) / 0.4)",
				}}
			>
				<Icon
					size={14}
					style={{ color: adminOnly ? "#7c3aed" : "var(--brand-600)", flexShrink: 0 }}
				/>
				<span
					style={{
						fontWeight: 600,
						fontSize: "0.82rem",
						color: adminOnly ? "#5b21b6" : "hsl(var(--foreground))",
					}}
				>
					{title}
				</span>
				{adminOnly && (
					<span
						style={{
							marginLeft: "auto",
							fontSize: "0.68rem",
							fontWeight: 600,
							color: "#7c3aed",
							background: "#ede9fe",
							padding: "1px 7px",
							borderRadius: 99,
						}}
					>
						Admin
					</span>
				)}
			</div>
			<div style={{ padding: 16 }}>{children}</div>
		</div>
	);
}

function StatPill({
	value,
	label,
	color,
}: {
	value: string | number;
	label: string;
	color: string;
}) {
	return (
		<div
			style={{
				textAlign: "center",
				padding: "12px 16px",
				background: "hsl(var(--muted) / 0.4)",
				borderRadius: "calc(var(--radius) * 1.2)",
				flex: 1,
			}}
		>
			<div style={{ fontSize: "1.6rem", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
			<div style={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
				{label}
			</div>
		</div>
	);
}

// ── Review Analytics Section ──────────────────────────────────────────────────

type DrillLevel =
	| { level: "tag" }
	| { level: "group"; groupId: string }
	| { level: "student"; groupId: string; studentId: string };

interface ReviewAnalyticsProps {
	guideCriteria: Criteria[];
	panelCriteria: Criteria[];
	allGrades: Grade[];
	groupReviewStatuses: GroupReviewStatus[];
	groups: Group[];
	students: Student[];
}

function ReviewAnalyticsSection({
	guideCriteria,
	panelCriteria,
	allGrades,
	groupReviewStatuses,
	groups,
	students,
}: ReviewAnalyticsProps) {
	const [drill, setDrill] = useState<DrillLevel>({ level: "tag" });

	const guideCritIds = new Set(guideCriteria.map((c) => c.id));
	const panelCritIds = new Set(panelCriteria.map((c) => c.id));
	const guideGrades = allGrades.filter((g) => guideCritIds.has(g.criteria_id));
	const panelGrades = allGrades.filter((g) => panelCritIds.has(g.criteria_id));

	const guideMax = critMax(guideCriteria);
	const panelMax = critMax(panelCriteria);

	// ── TAG level: group stats table ───────────────────────────────────────────

	interface GroupStat {
		group: Group;
		guidePct: number;
		panelPct: number;
		combinedPct: number;
		studentsScored: number;
		totalStudents: number;
		guideApproved: boolean;
	}

	const groupStats: GroupStat[] = groups
		.map((group) => {
			const groupStudents = students.filter((s) => s.group_id === group.id);
			const guideScored = groupStudents.filter((s) =>
				guideGrades.some((g) => g.student_id === s.id),
			);
			const panelScored = groupStudents.filter((s) =>
				panelGrades.some((g) => g.student_id === s.id),
			);
			const scored = groupStudents.filter(
				(s) =>
					guideGrades.some((g) => g.student_id === s.id) ||
					panelGrades.some((g) => g.student_id === s.id),
			);

			const guidePct =
				guideScored.length > 0 && guideMax > 0
					? guideScored.reduce(
							(s, st) => s + studentAvgPct(st.id, guideGrades, guideCriteria, guideMax),
							0,
						) / guideScored.length
					: 0;
			const panelPct =
				panelScored.length > 0 && panelMax > 0
					? panelScored.reduce(
							(s, st) => s + studentAvgPct(st.id, panelGrades, panelCriteria, panelMax),
							0,
						) / panelScored.length
					: 0;
			const combinedPct = (guidePct + panelPct) / 2;

			const grs = groupReviewStatuses.find((s) => s.group_id === group.id);

			return {
				group,
				guidePct,
				panelPct,
				combinedPct,
				studentsScored: scored.length,
				totalStudents: groupStudents.length,
				guideApproved: grs?.guide_approval_status === "approved",
			};
		})
		.filter((s) => s.totalStudents > 0)
		.sort((a, b) => b.combinedPct - a.combinedPct);

	// ── Render group drill-down ────────────────────────────────────────────────

	if (drill.level === "group") {
		const group = groups.find((g) => g.id === drill.groupId)!;
		const groupStudents = students.filter((s) => s.group_id === drill.groupId);
		const grs = groupReviewStatuses.find((s) => s.group_id === drill.groupId);

		const studentRows = groupStudents
			.map((s) => ({
				student: s,
				guidePct: guideMax > 0 ? studentAvgPct(s.id, guideGrades, guideCriteria, guideMax) : 0,
				panelPct: panelMax > 0 ? studentAvgPct(s.id, panelGrades, panelCriteria, panelMax) : 0,
			}))
			.map((r) => ({ ...r, combinedPct: (r.guidePct + r.panelPct) / 2 }));

		// Per-criteria average for guide and panel
		const guideCritData = guideCriteria.map((c) => {
			const max = c.sub_criteria?.length
				? c.sub_criteria.reduce((s, sc) => s + sc.max_marks, 0)
				: c.max_marks;
			const pct = c.sub_criteria?.length
				? c.sub_criteria.reduce(
						(s, sc) => s + critAvgPct(c.id, guideGrades, sc.max_marks, sc.id),
						0,
					) / c.sub_criteria.length
				: critAvgPct(c.id, guideGrades, max);
			return { name: c.title, max, pct, type: "guide" };
		});
		const panelCritData = panelCriteria.map((c) => {
			const max = c.sub_criteria?.length
				? c.sub_criteria.reduce((s, sc) => s + sc.max_marks, 0)
				: c.max_marks;
			const pct = c.sub_criteria?.length
				? c.sub_criteria.reduce(
						(s, sc) => s + critAvgPct(c.id, panelGrades, sc.max_marks, sc.id),
						0,
					) / c.sub_criteria.length
				: critAvgPct(c.id, panelGrades, max);
			return { name: c.title, max, pct, type: "panel" };
		});

		return (
			<SectionCard title={`${group.name} — Group Detail`} icon={Users} adminOnly>
				{/* Breadcrumb */}
				<button
					onClick={() => setDrill({ level: "tag" })}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 4,
						fontSize: "0.78rem",
						color: "hsl(var(--primary))",
						background: "none",
						border: "none",
						cursor: "pointer",
						marginBottom: 14,
						padding: 0,
					}}
				>
					<ArrowLeft size={12} /> Back to all groups
				</button>

				{/* Group header info */}
				<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
					<StatPill
						value={`${groupStats.find((gs) => gs.group.id === drill.groupId)?.guidePct.toFixed(1) ?? "—"}%`}
						label="Guide avg"
						color="#7c3aed"
					/>
					<StatPill
						value={`${groupStats.find((gs) => gs.group.id === drill.groupId)?.panelPct.toFixed(1) ?? "—"}%`}
						label="Panel avg"
						color="#0369a1"
					/>
					<StatPill
						value={`${groupStats.find((gs) => gs.group.id === drill.groupId)?.combinedPct.toFixed(1) ?? "—"}%`}
						label="Combined"
						color={pctColor(
							groupStats.find((gs) => gs.group.id === drill.groupId)?.combinedPct ?? 0,
						)}
					/>
					<div
						style={{
							textAlign: "center",
							padding: "12px 16px",
							background:
								grs?.guide_approval_status === "approved" ? "#dcfce7" : "hsl(var(--muted) / 0.4)",
							borderRadius: "calc(var(--radius) * 1.2)",
							flex: 1,
						}}
					>
						<div
							style={{
								fontSize: "0.9rem",
								fontWeight: 700,
								color: grs?.guide_approval_status === "approved" ? "#16a34a" : "#ca8a04",
							}}
						>
							{grs?.guide_approval_status === "approved" ? (
								<CheckCircle2 size={18} style={{ display: "inline" }} />
							) : (
								<Clock size={18} style={{ display: "inline" }} />
							)}
						</div>
						<div
							style={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))", marginTop: 4 }}
						>
							Guide {grs?.guide_approval_status ?? "pending"}
						</div>
					</div>
				</div>

				{/* Student table */}
				<p
					style={{
						fontSize: "0.78rem",
						fontWeight: 600,
						color: "hsl(var(--muted-foreground))",
						marginBottom: 8,
					}}
				>
					Students
				</p>
				<div style={{ overflowX: "auto", marginBottom: 20 }}>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
						<thead>
							<tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
								{["Student", "Roll No.", "Guide", "Panel", "Combined", ""].map((h) => (
									<th
										key={h}
										style={{
											padding: "6px 8px",
											textAlign: "left",
											fontWeight: 600,
											color: "hsl(var(--muted-foreground))",
											fontSize: "0.72rem",
											whiteSpace: "nowrap",
										}}
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{studentRows.map((row) => (
								<tr
									key={row.student.id}
									style={{ borderBottom: "1px solid hsl(var(--border) / 0.5)", cursor: "pointer" }}
									onClick={() =>
										setDrill({
											level: "student",
											groupId: drill.groupId,
											studentId: row.student.id,
										})
									}
								>
									<td style={{ padding: "8px" }}>
										<span style={{ fontWeight: 600 }}>{row.student.name}</span>
									</td>
									<td style={{ padding: "8px", color: "hsl(var(--muted-foreground))" }}>
										{row.student.roll_number}
									</td>
									<td style={{ padding: "8px", fontWeight: 700, color: "#7c3aed" }}>
										{guideMax > 0 && guideGrades.some((g) => g.student_id === row.student.id)
											? `${row.guidePct.toFixed(1)}%`
											: "—"}
									</td>
									<td style={{ padding: "8px", fontWeight: 700, color: "#0369a1" }}>
										{panelMax > 0 && panelGrades.some((g) => g.student_id === row.student.id)
											? `${row.panelPct.toFixed(1)}%`
											: "—"}
									</td>
									<td style={{ padding: "8px", fontWeight: 700, color: pctColor(row.combinedPct) }}>
										{guideGrades.some((g) => g.student_id === row.student.id) ||
										panelGrades.some((g) => g.student_id === row.student.id)
											? `${row.combinedPct.toFixed(1)}%`
											: "—"}
									</td>
									<td style={{ padding: "8px", width: 70 }}>
										<HBar
											pct={row.combinedPct}
											color={pctColor(row.combinedPct)}
											bg="hsl(var(--muted))"
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Per-criteria breakdown */}
				{(guideCritData.length > 0 || panelCritData.length > 0) && (
					<>
						<p
							style={{
								fontSize: "0.78rem",
								fontWeight: 600,
								color: "hsl(var(--muted-foreground))",
								marginBottom: 10,
							}}
						>
							Criteria breakdown
						</p>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
							{guideCritData.length > 0 && (
								<div>
									<p
										style={{
											fontSize: "0.72rem",
											fontWeight: 700,
											color: "#7c3aed",
											textTransform: "uppercase",
											letterSpacing: "0.05em",
											marginBottom: 8,
										}}
									>
										Guide
									</p>
									<div style={{ display: "grid", gap: 8 }}>
										{guideCritData.map((d) => (
											<div key={d.name}>
												<div
													style={{
														display: "flex",
														justifyContent: "space-between",
														marginBottom: 3,
													}}
												>
													<span
														style={{
															fontSize: "0.73rem",
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
															maxWidth: "70%",
														}}
													>
														{d.name}
													</span>
													<span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#7c3aed" }}>
														{d.pct.toFixed(0)}%
													</span>
												</div>
												<HBar pct={d.pct} color="#7c3aed" bg="#ede9fe" />
											</div>
										))}
									</div>
								</div>
							)}
							{panelCritData.length > 0 && (
								<div>
									<p
										style={{
											fontSize: "0.72rem",
											fontWeight: 700,
											color: "#0369a1",
											textTransform: "uppercase",
											letterSpacing: "0.05em",
											marginBottom: 8,
										}}
									>
										Panel
									</p>
									<div style={{ display: "grid", gap: 8 }}>
										{panelCritData.map((d) => (
											<div key={d.name}>
												<div
													style={{
														display: "flex",
														justifyContent: "space-between",
														marginBottom: 3,
													}}
												>
													<span
														style={{
															fontSize: "0.73rem",
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
															maxWidth: "70%",
														}}
													>
														{d.name}
													</span>
													<span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#0369a1" }}>
														{d.pct.toFixed(0)}%
													</span>
												</div>
												<HBar pct={d.pct} color="#0369a1" bg="#e0f2fe" />
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</>
				)}
			</SectionCard>
		);
	}

	// ── Student drill-down ─────────────────────────────────────────────────────

	if (drill.level === "student") {
		const group = groups.find((g) => g.id === drill.groupId)!;
		const student = students.find((s) => s.id === drill.studentId)!;

		const studentGuideGrades = guideGrades.filter((g) => g.student_id === drill.studentId);
		const studentPanelGrades = panelGrades.filter((g) => g.student_id === drill.studentId);

		const guideRaterIds = [...new Set(studentGuideGrades.map((g) => g.faculty_id))];
		const panelRaterIds = [...new Set(studentPanelGrades.map((g) => g.faculty_id))];

		const guidePct =
			guideMax > 0 ? studentAvgPct(drill.studentId, guideGrades, guideCriteria, guideMax) : 0;
		const panelPct =
			panelMax > 0 ? studentAvgPct(drill.studentId, panelGrades, panelCriteria, panelMax) : 0;

		// Per-criteria scores for this student
		const guideCritRows = guideCriteria.map((c) => {
			const max = c.sub_criteria?.length
				? c.sub_criteria.reduce((s, sc) => s + sc.max_marks, 0)
				: c.max_marks;
			const avgScore =
				guideRaterIds.length === 0
					? 0
					: guideRaterIds.reduce((sum, fid) => {
							let raterScore = 0;
							if (c.sub_criteria?.length) {
								for (const sub of c.sub_criteria) {
									raterScore +=
										studentGuideGrades.find(
											(g) =>
												g.faculty_id === fid &&
												g.criteria_id === c.id &&
												g.sub_criteria_id === sub.id,
										)?.marks ?? 0;
								}
							} else {
								raterScore +=
									studentGuideGrades.find(
										(g) =>
											g.faculty_id === fid && g.criteria_id === c.id && g.sub_criteria_id === null,
									)?.marks ?? 0;
							}
							return sum + raterScore;
						}, 0) / guideRaterIds.length;
			return { name: c.title, score: avgScore, max, pct: max > 0 ? (avgScore / max) * 100 : 0 };
		});

		const panelCritRows = panelCriteria.map((c) => {
			const max = c.sub_criteria?.length
				? c.sub_criteria.reduce((s, sc) => s + sc.max_marks, 0)
				: c.max_marks;
			const avgScore =
				panelRaterIds.length === 0
					? 0
					: panelRaterIds.reduce((sum, fid) => {
							let raterScore = 0;
							if (c.sub_criteria?.length) {
								for (const sub of c.sub_criteria) {
									raterScore +=
										studentPanelGrades.find(
											(g) =>
												g.faculty_id === fid &&
												g.criteria_id === c.id &&
												g.sub_criteria_id === sub.id,
										)?.marks ?? 0;
								}
							} else {
								raterScore +=
									studentPanelGrades.find(
										(g) =>
											g.faculty_id === fid && g.criteria_id === c.id && g.sub_criteria_id === null,
									)?.marks ?? 0;
							}
							return sum + raterScore;
						}, 0) / panelRaterIds.length;
			return { name: c.title, score: avgScore, max, pct: max > 0 ? (avgScore / max) * 100 : 0 };
		});

		return (
			<SectionCard title={`${student.name} — Student Scorecard`} icon={Award} adminOnly>
				{/* Breadcrumb */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						fontSize: "0.78rem",
						marginBottom: 14,
					}}
				>
					<button
						onClick={() => setDrill({ level: "tag" })}
						style={{
							color: "hsl(var(--primary))",
							background: "none",
							border: "none",
							cursor: "pointer",
							padding: 0,
						}}
					>
						All groups
					</button>
					<ChevronRight size={12} style={{ color: "hsl(var(--muted-foreground))" }} />
					<button
						onClick={() => setDrill({ level: "group", groupId: drill.groupId })}
						style={{
							color: "hsl(var(--primary))",
							background: "none",
							border: "none",
							cursor: "pointer",
							padding: 0,
						}}
					>
						{group.name}
					</button>
					<ChevronRight size={12} style={{ color: "hsl(var(--muted-foreground))" }} />
					<span style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>{student.name}</span>
				</div>

				{/* Summary pills */}
				<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
					<StatPill
						value={guideRaterIds.length > 0 ? `${guidePct.toFixed(1)}%` : "—"}
						label={`Guide (${guideRaterIds.length} rater${guideRaterIds.length !== 1 ? "s" : ""})`}
						color="#7c3aed"
					/>
					<StatPill
						value={panelRaterIds.length > 0 ? `${panelPct.toFixed(1)}%` : "—"}
						label={`Panel (${panelRaterIds.length} rater${panelRaterIds.length !== 1 ? "s" : ""})`}
						color="#0369a1"
					/>
					<StatPill
						value={
							guideRaterIds.length > 0 || panelRaterIds.length > 0
								? `${((guidePct + panelPct) / 2).toFixed(1)}%`
								: "—"
						}
						label="Combined avg"
						color={pctColor((guidePct + panelPct) / 2)}
					/>
				</div>

				{/* Per-criteria tables */}
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
					{guideCritRows.length > 0 && (
						<div>
							<p
								style={{
									fontSize: "0.72rem",
									fontWeight: 700,
									color: "#7c3aed",
									textTransform: "uppercase",
									letterSpacing: "0.05em",
									marginBottom: 10,
								}}
							>
								Guide · {guideRaterIds.length} rater{guideRaterIds.length !== 1 ? "s" : ""}
							</p>
							<div style={{ display: "grid", gap: 10 }}>
								{guideCritRows.map((r) => (
									<div key={r.name}>
										<div
											style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}
										>
											<span
												style={{
													fontSize: "0.73rem",
													maxWidth: "65%",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{r.name}
											</span>
											<span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#7c3aed" }}>
												{r.score.toFixed(1)}/{r.max}
											</span>
										</div>
										<HBar pct={r.pct} color="#7c3aed" bg="#ede9fe" />
									</div>
								))}
							</div>
						</div>
					)}
					{panelCritRows.length > 0 && (
						<div>
							<p
								style={{
									fontSize: "0.72rem",
									fontWeight: 700,
									color: "#0369a1",
									textTransform: "uppercase",
									letterSpacing: "0.05em",
									marginBottom: 10,
								}}
							>
								Panel · {panelRaterIds.length} rater{panelRaterIds.length !== 1 ? "s" : ""}
							</p>
							<div style={{ display: "grid", gap: 10 }}>
								{panelCritRows.map((r) => (
									<div key={r.name}>
										<div
											style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}
										>
											<span
												style={{
													fontSize: "0.73rem",
													maxWidth: "65%",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{r.name}
											</span>
											<span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#0369a1" }}>
												{r.score.toFixed(1)}/{r.max}
											</span>
										</div>
										<HBar pct={r.pct} color="#0369a1" bg="#e0f2fe" />
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</SectionCard>
		);
	}

	// ── TAG level: overview + group table ─────────────────────────────────────

	const guideStudentIds = new Set(guideGrades.map((g) => g.student_id));
	const panelStudentIds = new Set(panelGrades.map((g) => g.student_id));

	const guideAvgPct =
		guideMax > 0 && guideStudentIds.size > 0
			? [...guideStudentIds].reduce(
					(s, sid) => s + studentAvgPct(sid, guideGrades, guideCriteria, guideMax),
					0,
				) / guideStudentIds.size
			: 0;
	const panelAvgPct =
		panelMax > 0 && panelStudentIds.size > 0
			? [...panelStudentIds].reduce(
					(s, sid) => s + studentAvgPct(sid, panelGrades, panelCriteria, panelMax),
					0,
				) / panelStudentIds.size
			: 0;

	// Per-criteria averages for the chart
	const critChartData = [
		...guideCriteria.map((c) => {
			const max = c.sub_criteria?.length
				? c.sub_criteria.reduce((s, sc) => s + sc.max_marks, 0)
				: c.max_marks;
			const pct = c.sub_criteria?.length
				? c.sub_criteria.reduce(
						(s, sc) => s + critAvgPct(c.id, guideGrades, sc.max_marks, sc.id),
						0,
					) / c.sub_criteria.length
				: critAvgPct(c.id, guideGrades, max);
			return {
				name: c.title.length > 14 ? c.title.slice(0, 12) + "…" : c.title,
				fullName: c.title,
				Guide: parseFloat(pct.toFixed(1)),
				Panel: 0,
				type: "guide",
			};
		}),
		...panelCriteria.map((c) => {
			const max = c.sub_criteria?.length
				? c.sub_criteria.reduce((s, sc) => s + sc.max_marks, 0)
				: c.max_marks;
			const pct = c.sub_criteria?.length
				? c.sub_criteria.reduce(
						(s, sc) => s + critAvgPct(c.id, panelGrades, sc.max_marks, sc.id),
						0,
					) / c.sub_criteria.length
				: critAvgPct(c.id, panelGrades, max);
			return {
				name: c.title.length > 14 ? c.title.slice(0, 12) + "…" : c.title,
				fullName: c.title,
				Guide: 0,
				Panel: parseFloat(pct.toFixed(1)),
				type: "panel",
			};
		}),
	];

	const groupsEvaluated = groupStats.filter((s) => s.studentsScored > 0).length;
	const allStudentIds = new Set([...guideStudentIds, ...panelStudentIds]);

	return (
		<SectionCard title="Review Performance" icon={TrendingUp} adminOnly>
			{/* Summary pills */}
			<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
				<StatPill
					value={guideAvgPct > 0 ? `${guideAvgPct.toFixed(1)}%` : "—"}
					label="Guide avg"
					color="#7c3aed"
				/>
				<StatPill
					value={panelAvgPct > 0 ? `${panelAvgPct.toFixed(1)}%` : "—"}
					label="Panel avg"
					color="#0369a1"
				/>
				<StatPill
					value={
						guideAvgPct > 0 || panelAvgPct > 0
							? `${((guideAvgPct + panelAvgPct) / 2).toFixed(1)}%`
							: "—"
					}
					label="Combined avg"
					color={pctColor((guideAvgPct + panelAvgPct) / 2)}
				/>
				<StatPill
					value={`${groupsEvaluated}/${groups.length}`}
					label="Groups evaluated"
					color="var(--brand-600)"
				/>
				<StatPill value={allStudentIds.size} label="Students scored" color="#4f46e5" />
			</div>

			{/* Per-criteria chart */}
			{critChartData.length > 0 && (
				<>
					<p
						style={{ fontSize: "0.78rem", color: "hsl(var(--muted-foreground))", marginBottom: 10 }}
					>
						Average score per criterion (as % of max)
					</p>
					<ResponsiveContainer width="100%" height={Math.max(160, critChartData.length * 28)}>
						<BarChart
							layout="vertical"
							data={critChartData}
							margin={{ left: 8, right: 32, top: 0, bottom: 0 }}
							barSize={10}
						>
							<XAxis
								type="number"
								domain={[0, 100]}
								tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
								tickFormatter={(v) => `${v}%`}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								dataKey="name"
								type="category"
								width={100}
								tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
							/>
							<Tooltip
								content={({ active, payload, label }) => {
									if (!active || !payload?.length) return null;
									const entry = critChartData.find((d) => d.name === label);
									return (
										<div
											style={{
												background: "hsl(var(--card))",
												border: "1px solid hsl(var(--border))",
												borderRadius: 8,
												padding: "8px 12px",
												fontSize: "0.78rem",
											}}
										>
											<p style={{ margin: "0 0 4px", fontWeight: 600 }}>
												{entry?.fullName ?? label}
											</p>
											{payload.map(
												(p) =>
													Number(p.value) > 0 && (
														<p
															key={p.name}
															style={{
																margin: 0,
																color: p.name === "Guide" ? "#7c3aed" : "#0369a1",
															}}
														>
															{p.name}: {p.value}%
														</p>
													),
											)}
										</div>
									);
								}}
							/>
							<Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.78rem" }} />
							<Bar dataKey="Guide" fill="#7c3aed" radius={[0, 4, 4, 0]} />
							<Bar dataKey="Panel" fill="#0369a1" radius={[0, 4, 4, 0]} />
						</BarChart>
					</ResponsiveContainer>
					<div style={{ height: 16 }} />
				</>
			)}

			{/* Group rankings table */}
			<p style={{ fontSize: "0.78rem", color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>
				Click a group to see per-student breakdown
			</p>
			<div style={{ overflowX: "auto" }}>
				<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
					<thead>
						<tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
							{["#", "Group", "Guide %", "Panel %", "Combined", "Students", "Guide", ""].map(
								(h) => (
									<th
										key={h}
										style={{
											padding: "6px 8px",
											textAlign: "left",
											fontWeight: 600,
											color: "hsl(var(--muted-foreground))",
											fontSize: "0.72rem",
											whiteSpace: "nowrap",
										}}
									>
										{h}
									</th>
								),
							)}
						</tr>
					</thead>
					<tbody>
						{groupStats.map((row, i) => (
							<tr
								key={row.group.id}
								onClick={() => setDrill({ level: "group", groupId: row.group.id })}
								style={{
									borderBottom: "1px solid hsl(var(--border) / 0.5)",
									cursor: "pointer",
									background: i % 2 === 0 ? "transparent" : "hsl(var(--muted) / 0.2)",
								}}
							>
								<td
									style={{ padding: "8px", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}
								>
									{i + 1}
								</td>
								<td style={{ padding: "8px" }}>
									<div style={{ fontWeight: 600 }}>{row.group.name}</div>
									{row.group.project_title && (
										<div
											style={{
												fontSize: "0.7rem",
												color: "hsl(var(--muted-foreground))",
												maxWidth: 180,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{row.group.project_title}
										</div>
									)}
								</td>
								<td
									style={{
										padding: "8px",
										fontWeight: 700,
										color: row.studentsScored > 0 ? "#7c3aed" : "hsl(var(--muted-foreground))",
									}}
								>
									{row.studentsScored > 0 && guideMax > 0 ? `${row.guidePct.toFixed(1)}%` : "—"}
								</td>
								<td
									style={{
										padding: "8px",
										fontWeight: 700,
										color: row.studentsScored > 0 ? "#0369a1" : "hsl(var(--muted-foreground))",
									}}
								>
									{row.studentsScored > 0 && panelMax > 0 ? `${row.panelPct.toFixed(1)}%` : "—"}
								</td>
								<td
									style={{
										padding: "8px",
										fontWeight: 700,
										color:
											row.studentsScored > 0
												? pctColor(row.combinedPct)
												: "hsl(var(--muted-foreground))",
									}}
								>
									{row.studentsScored > 0 ? `${row.combinedPct.toFixed(1)}%` : "—"}
								</td>
								<td style={{ padding: "8px", color: "hsl(var(--muted-foreground))" }}>
									{row.studentsScored}/{row.totalStudents}
								</td>
								<td style={{ padding: "8px" }}>
									{row.guideApproved ? (
										<span
											style={{
												fontSize: "0.68rem",
												fontWeight: 700,
												background: "#dcfce7",
												color: "#16a34a",
												padding: "2px 7px",
												borderRadius: 99,
											}}
										>
											Approved
										</span>
									) : (
										<span
											style={{
												fontSize: "0.68rem",
												fontWeight: 700,
												background: "hsl(var(--muted))",
												color: "hsl(var(--muted-foreground))",
												padding: "2px 7px",
												borderRadius: 99,
											}}
										>
											Pending
										</span>
									)}
								</td>
								<td style={{ padding: "8px", minWidth: 70 }}>
									<HBar
										pct={row.combinedPct}
										color={row.studentsScored > 0 ? pctColor(row.combinedPct) : "#e5e7eb"}
										bg="hsl(var(--muted))"
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{groupStats.length === 0 && (
					<p
						style={{
							textAlign: "center",
							fontSize: "0.84rem",
							color: "hsl(var(--muted-foreground))",
							padding: "20px 0",
						}}
					>
						No grading data for this review yet.
					</p>
				)}
			</div>
		</SectionCard>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsClient({
	isAdmin,
	facultyId,
	facultyName,
	groups,
	students,
	criteria,
	guideCriteria,
	myGrades,
	allGrades,
	profiles,
	reviews,
	selectedReviewId,
	groupReviewStatuses,
}: Props) {
	// ── Personal stats ─────────────────────────────────────────────────────────

	const myGradedStudentIds = new Set(myGrades.map((g) => g.student_id));
	const totalStudents = students.length;
	const myGradedCount = myGradedStudentIds.size;

	const groupsIEvaluated = groups.filter((g) => {
		const groupStudentIds = students.filter((s) => s.group_id === g.id).map((s) => s.id);
		return groupStudentIds.length > 0 && groupStudentIds.every((id) => myGradedStudentIds.has(id));
	});
	const groupsPartial = groups.filter((g) => {
		const groupStudentIds = students.filter((s) => s.group_id === g.id).map((s) => s.id);
		return (
			groupStudentIds.some((id) => myGradedStudentIds.has(id)) &&
			!groupStudentIds.every((id) => myGradedStudentIds.has(id))
		);
	});

	const myStudentPcts: number[] = [];
	for (const studentId of myGradedStudentIds) {
		const student = students.find((s) => s.id === studentId);
		if (!student) continue;
		const group = groups.find((g) => g.id === student.group_id);
		if (!group || !group.project_type) continue;
		const max = critMaxForGroup(group, criteria);
		if (max === 0) continue;
		const score = studentScoreByFaculty(studentId, group, criteria, myGrades, facultyId);
		myStudentPcts.push((score / max) * 100);
	}
	const myHistogram = bucketize(myStudentPcts);
	const myAvgPct =
		myStudentPcts.length > 0 ? myStudentPcts.reduce((a, b) => a + b, 0) / myStudentPcts.length : 0;

	const myCriteriaAvg: { title: string; avgPct: number; count: number }[] = criteria
		.map((crit) => {
			const relevantGrades = myGrades.filter((g) => g.criteria_id === crit.id);
			if (relevantGrades.length === 0) return { title: crit.title, avgPct: 0, count: 0 };
			const subCriteria = crit.sub_criteria ?? [];
			if (subCriteria.length > 0) {
				const subAvgs = subCriteria.map((sub) => {
					const subGrades = myGrades.filter(
						(g) => g.criteria_id === crit.id && g.sub_criteria_id === sub.id,
					);
					const avg =
						subGrades.length > 0
							? subGrades.reduce((a, g) => a + g.marks, 0) / subGrades.length
							: 0;
					return (avg / sub.max_marks) * 100;
				});
				return {
					title: crit.title,
					avgPct: subAvgs.reduce((a, b) => a + b, 0) / subAvgs.length,
					count: relevantGrades.length,
				};
			}
			const avg = relevantGrades.reduce((a, g) => a + g.marks, 0) / relevantGrades.length;
			return {
				title: crit.title,
				avgPct: (avg / crit.max_marks) * 100,
				count: relevantGrades.length,
			};
		})
		.filter((c) => c.count > 0);

	// ── Admin computations ─────────────────────────────────────────────────────

	const panelGradesOnly = allGrades.filter((g) => criteria.some((c) => c.id === g.criteria_id));
	const allGradedStudentIds = new Set(panelGradesOnly.map((g) => g.student_id));
	const classStudentPcts: number[] = [];
	for (const studentId of allGradedStudentIds) {
		const student = students.find((s) => s.id === studentId);
		if (!student) continue;
		const group = groups.find((g) => g.id === student.group_id);
		if (!group || !group.project_type) continue;
		const max = critMaxForGroup(group, criteria);
		if (max === 0) continue;
		const mean = studentMeanScore(studentId, group, criteria, panelGradesOnly);
		classStudentPcts.push((mean / max) * 100);
	}
	const classHistogram = bucketize(classStudentPcts);
	const classAvgPct =
		classStudentPcts.length > 0
			? classStudentPcts.reduce((a, b) => a + b, 0) / classStudentPcts.length
			: 0;

	const classCriteriaAvg: { title: string; avgPct: number; type: string }[] = criteria.map(
		(crit) => {
			const subCriteria = crit.sub_criteria ?? [];
			if (subCriteria.length > 0) {
				const subAvgs = subCriteria.map((sub) => {
					const subGrades = panelGradesOnly.filter(
						(g) => g.criteria_id === crit.id && g.sub_criteria_id === sub.id,
					);
					const avg =
						subGrades.length > 0
							? subGrades.reduce((a, g) => a + g.marks, 0) / subGrades.length
							: 0;
					return (avg / sub.max_marks) * 100;
				});
				return {
					title: crit.title,
					avgPct: subAvgs.reduce((a, b) => a + b, 0) / subAvgs.length,
					type: crit.project_type,
				};
			}
			const relevantGrades = panelGradesOnly.filter((g) => g.criteria_id === crit.id);
			const avg =
				relevantGrades.length > 0
					? relevantGrades.reduce((a, g) => a + g.marks, 0) / relevantGrades.length
					: 0;
			return { title: crit.title, avgPct: (avg / crit.max_marks) * 100, type: crit.project_type };
		},
	);

	interface LeaderboardRow {
		group: Group;
		pct: number;
		mean: number;
		max: number;
		gradedStudents: number;
		totalStudents: number;
		raterCount: number;
		spread: number;
	}
	const groupLeaderboard: LeaderboardRow[] = groups
		.filter((g) => g.project_type)
		.map((group) => {
			const groupStudents = students.filter((s) => s.group_id === group.id);
			const gradedStudents = groupStudents.filter((s) => allGradedStudentIds.has(s.id));
			if (gradedStudents.length === 0) return null;
			const max = critMaxForGroup(group, criteria);
			const studentMeans = gradedStudents.map((s) =>
				studentMeanScore(s.id, group, criteria, panelGradesOnly),
			);
			const groupMean = studentMeans.reduce((a, b) => a + b, 0) / studentMeans.length;
			const pct = max > 0 ? (groupMean / max) * 100 : 0;
			const facultyIds = [
				...new Set(
					panelGradesOnly
						.filter((g) => groupStudents.some((s) => s.id === g.student_id))
						.map((g) => g.faculty_id),
				),
			];
			const facultyTotals = facultyIds
				.map((fid) => {
					const scores = gradedStudents.map((s) =>
						studentScoreByFaculty(s.id, group, criteria, panelGradesOnly, fid),
					);
					return scores.reduce((a, b) => a + b, 0) / scores.length;
				})
				.filter((t) => t > 0);
			const spread =
				facultyTotals.length > 1 ? Math.max(...facultyTotals) - Math.min(...facultyTotals) : 0;
			return {
				group,
				pct,
				mean: groupMean,
				max,
				gradedStudents: gradedStudents.length,
				totalStudents: groupStudents.length,
				raterCount: facultyTotals.length,
				spread,
			};
		})
		.filter((r): r is LeaderboardRow => r !== null)
		.sort((a, b) => b.pct - a.pct);

	const facultyCoverage = profiles
		.map((p) => {
			const gradedStudentIds = new Set(
				panelGradesOnly.filter((g) => g.faculty_id === p.id).map((g) => g.student_id),
			);
			const gradedGroups = groups.filter((g) => {
				const gStudents = students.filter((s) => s.group_id === g.id).map((s) => s.id);
				return gStudents.some((id) => gradedStudentIds.has(id));
			});
			return {
				profile: p,
				studentsGraded: gradedStudentIds.size,
				groupsGraded: gradedGroups.length,
			};
		})
		.sort((a, b) => b.studentsGraded - a.studentsGraded);

	const adminTotalGraded = new Set(panelGradesOnly.map((g) => g.student_id)).size;

	// ── Current review name ─────────────────────────────────────────────────────
	const selectedReview = reviews.find((r) => r.id === selectedReviewId);

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div style={{ padding: "20px 20px 40px", maxWidth: 820 }}>
			{/* Page header */}
			<div style={{ marginBottom: 20 }}>
				<p className="eyebrow" style={{ marginBottom: 4 }}>
					Analytics
				</p>
				<h1
					style={{
						margin: 0,
						fontFamily: "var(--title-font)",
						fontSize: "1.9rem",
						letterSpacing: "-0.03em",
						color: "var(--app-hero-text)",
						lineHeight: 1.1,
					}}
				>
					Grading overview
				</h1>
				<p style={{ color: "var(--app-hero-subtext)", fontSize: "0.88rem", marginTop: 6 }}>
					{isAdmin
						? "Review performance, class-wide numbers and your grading summary."
						: "A look at how your grading has gone so far."}
				</p>
			</div>

			{/* Review selector */}
			{reviews.length > 0 && (
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
					{reviews.map((r) => (
						<Link
							key={r.id}
							href={`/analytics?reviewId=${r.id}`}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
								padding: "5px 12px",
								borderRadius: 999,
								fontSize: "0.78rem",
								fontWeight: 600,
								textDecoration: "none",
								background: r.id === selectedReviewId ? "hsl(var(--primary))" : "hsl(var(--muted))",
								color:
									r.id === selectedReviewId
										? "hsl(var(--primary-foreground))"
										: "hsl(var(--muted-foreground))",
								border: `1px solid ${r.id === selectedReviewId ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
								transition: "all 0.15s ease",
							}}
						>
							{r.name}
						</Link>
					))}
				</div>
			)}

			<div style={{ display: "grid", gap: 16 }}>
				{/* ── Review analytics (admin + guide/panel data available) ── */}
				{isAdmin && (guideCriteria.length > 0 || criteria.length > 0) && (
					<ReviewAnalyticsSection
						guideCriteria={guideCriteria}
						panelCriteria={criteria}
						allGrades={allGrades}
						groupReviewStatuses={groupReviewStatuses}
						groups={groups}
						students={students}
					/>
				)}

				{/* ── Personal: summary pills ── */}
				<SectionCard
					title={`My panel grading — ${facultyName}${selectedReview ? ` · ${selectedReview.name}` : ""}`}
					icon={Activity}
				>
					<div
						style={{
							display: "flex",
							gap: 10,
							flexWrap: "wrap",
							marginBottom: myGradedCount > 0 ? 16 : 0,
						}}
					>
						<StatPill
							value={groupsIEvaluated.length}
							label="Teams fully graded"
							color="var(--brand-600)"
						/>
						<StatPill value={groupsPartial.length} label="Teams in progress" color="#ca8a04" />
						<StatPill
							value={myGradedCount}
							label={`of ${totalStudents} students`}
							color="#4f46e5"
						/>
						<StatPill
							value={myStudentPcts.length > 0 ? `${myAvgPct.toFixed(1)}%` : "—"}
							label="Avg score given"
							color={myAvgPct > 0 ? pctColor(myAvgPct) : "hsl(var(--muted-foreground))"}
						/>
					</div>
					{myGradedCount === 0 && (
						<p
							style={{
								color: "hsl(var(--muted-foreground))",
								fontSize: "0.84rem",
								textAlign: "center",
								padding: "8px 0",
							}}
						>
							You haven&apos;t graded any students yet
							{selectedReview ? ` in ${selectedReview.name}` : ""}.
						</p>
					)}
				</SectionCard>

				{/* ── Personal: score distribution ── */}
				{myStudentPcts.length > 0 && (
					<SectionCard title="How I scored" icon={BarChart2}>
						<p
							style={{
								fontSize: "0.78rem",
								color: "hsl(var(--muted-foreground))",
								marginBottom: 12,
							}}
						>
							Scores given across {myStudentPcts.length} student
							{myStudentPcts.length !== 1 ? "s" : ""}, as a share of the maximum
						</p>
						<Histogram bins={myHistogram} />
						<p
							style={{
								fontSize: "0.75rem",
								color: "hsl(var(--muted-foreground))",
								textAlign: "center",
								marginTop: 6,
							}}
						>
							Score bucket (%)
						</p>
					</SectionCard>
				)}

				{/* ── Personal: criteria pattern ── */}
				{myCriteriaAvg.length > 0 && (
					<SectionCard title="My scoring by criterion" icon={Target}>
						<p
							style={{
								fontSize: "0.78rem",
								color: "hsl(var(--muted-foreground))",
								marginBottom: 14,
							}}
						>
							How your marks compare to the maximum, for each criterion
						</p>
						<div style={{ display: "grid", gap: 10 }}>
							{myCriteriaAvg.map(({ title, avgPct }) => (
								<div key={title}>
									<div
										style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}
									>
										<span
											style={{
												fontSize: "0.78rem",
												color: "hsl(var(--foreground))",
												maxWidth: "70%",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{title}
										</span>
										<span style={{ fontSize: "0.78rem", fontWeight: 700, color: pctColor(avgPct) }}>
											{avgPct.toFixed(1)}%
										</span>
									</div>
									<HBar pct={avgPct} color={pctColor(avgPct)} />
								</div>
							))}
						</div>
					</SectionCard>
				)}

				{/* ── Admin: class overview (panel) ── */}
				{isAdmin && (
					<SectionCard title="Panel overview" icon={Users} adminOnly>
						<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
							<StatPill
								value={adminTotalGraded}
								label={`of ${totalStudents} students graded`}
								color="#4f46e5"
							/>
							<StatPill
								value={groupLeaderboard.length}
								label={`of ${groups.filter((g) => g.project_type).length} teams evaluated`}
								color="var(--brand-600)"
							/>
							<StatPill
								value={classStudentPcts.length > 0 ? `${classAvgPct.toFixed(1)}%` : "—"}
								label="Panel avg score"
								color={classAvgPct > 0 ? pctColor(classAvgPct) : "hsl(var(--muted-foreground))"}
							/>
							<StatPill
								value={facultyCoverage.filter((f) => f.studentsGraded > 0).length}
								label={`of ${profiles.length} faculty graded`}
								color="#7c3aed"
							/>
						</div>
					</SectionCard>
				)}

				{/* ── Admin: class score distribution ── */}
				{isAdmin && classStudentPcts.length > 0 && (
					<SectionCard title="Panel score distribution" icon={BarChart2} adminOnly>
						<p
							style={{
								fontSize: "0.78rem",
								color: "hsl(var(--muted-foreground))",
								marginBottom: 12,
							}}
						>
							Each student&apos;s average panel score across all reviewers —{" "}
							{classStudentPcts.length} student{classStudentPcts.length !== 1 ? "s" : ""} graded
						</p>
						<Histogram bins={classHistogram} />
						<p
							style={{
								fontSize: "0.75rem",
								color: "hsl(var(--muted-foreground))",
								textAlign: "center",
								marginTop: 6,
							}}
						>
							Score bucket (%)
						</p>
					</SectionCard>
				)}

				{/* ── Admin: criteria heatmap ── */}
				{isAdmin && classCriteriaAvg.length > 0 && (
					<SectionCard title="Panel results by criterion" icon={TrendingUp} adminOnly>
						<p
							style={{
								fontSize: "0.78rem",
								color: "hsl(var(--muted-foreground))",
								marginBottom: 14,
							}}
						>
							Where students scored well and where they fell short, across all panel reviewers
						</p>
						<div style={{ display: "grid", gap: 10 }}>
							{classCriteriaAvg.map(({ title, avgPct, type }) => {
								const tc = type !== "all" ? typeColor(type) : null;
								return (
									<div key={title}>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												marginBottom: 4,
												gap: 8,
											}}
										>
											<div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
												{tc && (
													<span
														style={{
															flexShrink: 0,
															fontSize: "0.65rem",
															fontWeight: 700,
															padding: "1px 6px",
															borderRadius: 99,
															background: tc.bg,
															color: tc.tx,
														}}
													>
														{capitalize(type)}
													</span>
												)}
												<span
													style={{
														fontSize: "0.78rem",
														color: "hsl(var(--foreground))",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{title}
												</span>
											</div>
											<span
												style={{
													flexShrink: 0,
													fontSize: "0.78rem",
													fontWeight: 700,
													color: pctColor(avgPct),
												}}
											>
												{avgPct.toFixed(1)}%
											</span>
										</div>
										<HBar pct={avgPct} color={pctColor(avgPct)} />
									</div>
								);
							})}
						</div>
					</SectionCard>
				)}

				{/* ── Admin: group leaderboard (panel) ── */}
				{isAdmin && groupLeaderboard.length > 0 && (
					<SectionCard title="Panel group rankings" icon={Award} adminOnly>
						<p
							style={{
								fontSize: "0.78rem",
								color: "hsl(var(--muted-foreground))",
								marginBottom: 12,
							}}
						>
							Groups sorted by their average panel score across all reviewers
						</p>
						<div style={{ overflowX: "auto" }}>
							<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
								<thead>
									<tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
										{["#", "Group", "Type", "Score", "Raters", "Spread", ""].map((h) => (
											<th
												key={h}
												style={{
													padding: "6px 8px",
													textAlign: "left",
													fontWeight: 600,
													color: "hsl(var(--muted-foreground))",
													whiteSpace: "nowrap",
													fontSize: "0.73rem",
												}}
											>
												{h}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{groupLeaderboard.map((row: LeaderboardRow, i: number) => {
										const tc = typeColor(row.group.project_type);
										return (
											<tr
												key={row.group.id}
												style={{
													borderBottom: "1px solid hsl(var(--border) / 0.5)",
													background: i % 2 === 0 ? "transparent" : "hsl(var(--muted) / 0.2)",
												}}
											>
												<td
													style={{
														padding: "8px",
														color: "hsl(var(--muted-foreground))",
														fontWeight: 600,
													}}
												>
													{i + 1}
												</td>
												<td style={{ padding: "8px" }}>
													<div style={{ fontWeight: 600 }}>{row.group.name}</div>
													{row.group.project_title && (
														<div
															style={{
																fontSize: "0.7rem",
																color: "hsl(var(--muted-foreground))",
																maxWidth: 180,
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
															}}
														>
															{row.group.project_title}
														</div>
													)}
												</td>
												<td style={{ padding: "8px" }}>
													<span
														style={{
															fontSize: "0.68rem",
															fontWeight: 700,
															padding: "2px 7px",
															borderRadius: 99,
															background: tc.bg,
															color: tc.tx,
														}}
													>
														{capitalize(row.group.project_type)}
													</span>
												</td>
												<td style={{ padding: "8px", fontWeight: 700, color: pctColor(row.pct) }}>
													{row.pct.toFixed(1)}%
												</td>
												<td style={{ padding: "8px", color: "hsl(var(--muted-foreground))" }}>
													{row.raterCount}
												</td>
												<td
													style={{
														padding: "8px",
														color:
															row.spread > 20 ? "#dc2626" : row.spread > 10 ? "#ca8a04" : "#16a34a",
														fontWeight: 600,
													}}
												>
													{row.spread > 0 ? `±${(row.spread / 2).toFixed(1)}` : "—"}
												</td>
												<td style={{ padding: "8px", minWidth: 80 }}>
													<HBar pct={row.pct} color={pctColor(row.pct)} bg="hsl(var(--muted))" />
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<p style={{ fontSize: "0.7rem", color: "hsl(var(--muted-foreground))", marginTop: 10 }}>
							Spread: how far apart reviewers&apos; totals were for that group
						</p>
					</SectionCard>
				)}

				{/* ── Admin: faculty coverage ── */}
				{isAdmin && facultyCoverage.length > 0 && (
					<SectionCard title="Panel reviewer coverage" icon={ShieldCheck} adminOnly>
						<p
							style={{
								fontSize: "0.78rem",
								color: "hsl(var(--muted-foreground))",
								marginBottom: 12,
							}}
						>
							Breakdown of students and groups each panel reviewer has covered
						</p>
						<div style={{ display: "grid", gap: 8 }}>
							{facultyCoverage.map(({ profile: p, studentsGraded, groupsGraded }) => {
								const pct = totalStudents > 0 ? (studentsGraded / totalStudents) * 100 : 0;
								return (
									<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
										<div
											style={{
												width: 30,
												height: 30,
												borderRadius: "50%",
												flexShrink: 0,
												background: "hsl(var(--muted))",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: "0.75rem",
												fontWeight: 700,
												color: "var(--brand-600)",
											}}
										>
											{p.name
												.split(" ")
												.map((w) => w[0])
												.slice(0, 2)
												.join("")
												.toUpperCase()}
										</div>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													marginBottom: 3,
												}}
											>
												<span
													style={{
														fontSize: "0.8rem",
														fontWeight: 600,
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{p.name}
												</span>
												<span
													style={{
														fontSize: "0.75rem",
														color: pctColor(pct),
														fontWeight: 600,
														flexShrink: 0,
														marginLeft: 8,
													}}
												>
													{studentsGraded} students · {groupsGraded} teams
												</span>
											</div>
											<HBar
												pct={pct}
												color={studentsGraded > 0 ? "hsl(var(--brand-600))" : "#e5e7eb"}
											/>
										</div>
									</div>
								);
							})}
						</div>
					</SectionCard>
				)}
			</div>
		</div>
	);
}
