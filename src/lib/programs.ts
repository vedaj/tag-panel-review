import type { Program } from "@/types/database";

export const PROGRAM_COOKIE = "tag:program";

export const PROGRAMS: { value: Program; label: string; description: string }[] = [
	{ value: "btech", label: "B.Tech", description: "Group projects" },
	{ value: "mtech", label: "M.Tech", description: "Individual projects" },
];

export function isProgram(value: unknown): value is Program {
	return value === "btech" || value === "mtech";
}

export function programLabel(program: Program): string {
	return program === "mtech" ? "M.Tech" : "B.Tech";
}

/** What one reviewed unit is called: a B.Tech group or an M.Tech (single-student) project. */
export function programTerms(program: Program) {
	return program === "mtech"
		? { unit: "Project", units: "Projects", unitLower: "project", unitsLower: "projects" }
		: { unit: "Group", units: "Groups", unitLower: "group", unitsLower: "groups" };
}

/**
 * Name to show for a group. An M.Tech project is stored under the student's
 * roll number, so it shows the student's name instead.
 */
export function groupDisplayName(group: {
	name: string;
	program?: Program | null;
	students?: { name: string }[] | null;
}): string {
	if (group.program === "mtech") return group.students?.[0]?.name || group.name;
	return group.name;
}
