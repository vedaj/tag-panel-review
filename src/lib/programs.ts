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
