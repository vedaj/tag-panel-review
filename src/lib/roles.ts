import type { AdminRole, Program, UserRole } from "@/types/database";
import { programLabel } from "@/lib/programs";

/** The admin role rows a check needs (a subset of UserRole). */
export type RoleRow = Pick<UserRole, "role" | "program" | "tag_id">;

/** Cookie holding the role the user is acting as */
export const ACTING_COOKIE = "tag:acting";

/** Which of their roles a user is currently acting as (highest to lowest). */
export type ActingRole = "institution" | "program" | "tag" | "faculty";

/** What the signed-in user may do right now. Serializable, so it can go to client components. */
export interface Access {
	userId: string;
	/** The user's home TAG */
	tagId: string | null;
	program: Program;
	/** Every role the user holds */
	realRoles: RoleRow[];
	/** The roles in effect for the acting role; use these for permission checks */
	roles: RoleRow[];
	acting: ActingRole;
	/** Roles the user can switch to in this program, highest first */
	actingOptions: ActingRole[];
	isInstitutionAdmin: boolean;
	/** Acting as B.Tech Admin / M.Tech Admin for the active program */
	isProgramAdmin: boolean;
	/** Acting as TAG admin of their home TAG in the active program */
	isTagAdmin: boolean;
	/** Any of the above */
	isAdmin: boolean;
	/** TAG to scope admin views to, or null for every TAG in the program */
	tagFilter: string | null;
	roleLabel: string;
}

export function hasRole(
	roles: RoleRow[],
	role: AdminRole,
	program?: Program | null,
	tagId?: string | null,
) {
	return roles.some(
		(r) =>
			r.role === role &&
			(program === undefined || r.program === program) &&
			(tagId === undefined || r.tag_id === tagId),
	);
}

/** Mirrors the database's can_admin(program, tag). */
export function canAdmin(roles: RoleRow[], program: Program, tagId: string | null | undefined) {
	return (
		hasRole(roles, "institution_admin") ||
		hasRole(roles, "program_admin", program) ||
		(!!tagId && hasRole(roles, "tag_admin", program, tagId))
	);
}

/** Short labels for every role a user holds, e.g. "M.Tech Admin", "B.Tech TAG Admin". */
export function roleLabels(roles: RoleRow[]): string[] {
	const order: AdminRole[] = ["institution_admin", "program_admin", "tag_admin"];
	return [...roles]
		.sort(
			(a, b) =>
				order.indexOf(a.role) - order.indexOf(b.role) ||
				(a.program ?? "").localeCompare(b.program ?? ""),
		)
		.map((r) =>
			r.role === "institution_admin"
				? "Institution Admin"
				: `${programLabel(r.program as Program)} ${r.role === "program_admin" ? "Admin" : "TAG Admin"}`,
		);
}

/**
 * Roles a user can act as in a program. A higher role can also act as any
 * level below it (e.g. an institution admin as TAG admin of their own TAG).
 */
export function actingOptions(
	roles: RoleRow[],
	program: Program,
	tagId: string | null,
): ActingRole[] {
	const inst = hasRole(roles, "institution_admin");
	const prog = inst || hasRole(roles, "program_admin", program);
	const tag = !!tagId && (prog || hasRole(roles, "tag_admin", program, tagId));
	const out: ActingRole[] = [];
	if (inst) out.push("institution");
	if (prog) out.push("program");
	if (tag) out.push("tag");
	out.push("faculty");
	return out;
}

export function actingLabel(acting: ActingRole, program: Program): string {
	const p = programLabel(program);
	switch (acting) {
		case "institution":
			return "Institution Admin";
		case "program":
			return `${p} Admin`;
		case "tag":
			return `${p} TAG Admin`;
		default:
			return "Faculty";
	}
}

/** The roles in effect while acting as one role. */
function effectiveRoles(
	acting: ActingRole,
	roles: RoleRow[],
	program: Program,
	tagId: string | null,
): RoleRow[] {
	switch (acting) {
		case "institution":
			return roles;
		case "program":
			return [{ role: "program_admin", program, tag_id: null }];
		case "tag":
			return [{ role: "tag_admin", program, tag_id: tagId }];
		default:
			return [];
	}
}

/**
 * Builds Access. requested is the acting role the user picked; it falls back
 * to their highest role when they cannot act as it in this program.
 */
export function buildAccess(
	userId: string,
	tagId: string | null,
	program: Program,
	roles: RoleRow[],
	requested: string | null | undefined,
): Access {
	const options = actingOptions(roles, program, tagId);
	const acting = options.includes(requested as ActingRole) ? (requested as ActingRole) : options[0];
	return {
		userId,
		tagId,
		program,
		realRoles: roles,
		roles: effectiveRoles(acting, roles, program, tagId),
		acting,
		actingOptions: options,
		isInstitutionAdmin: acting === "institution",
		isProgramAdmin: acting === "program",
		isTagAdmin: acting === "tag",
		isAdmin: acting !== "faculty",
		tagFilter: acting === "institution" || acting === "program" ? null : tagId,
		roleLabel: actingLabel(acting, program),
	};
}

/** A role an admin could grant or revoke for one user. */
export interface AssignableRole {
	role: AdminRole;
	program: Program | null;
	label: string;
	description: string;
}

/**
 * Roles the caller may toggle for a target user. Mirrors can_assign_role in
 * the database, which has the final say.
 */
export function assignableRoles(
	caller: RoleRow[],
	callerTagId: string | null,
	targetTagId: string | null,
): AssignableRole[] {
	const programs: Program[] = ["btech", "mtech"];
	const out: AssignableRole[] = [];
	const isInstitution = hasRole(caller, "institution_admin");
	if (isInstitution) {
		out.push({
			role: "institution_admin",
			program: null,
			label: "Institution Admin",
			description: "Everything, in both programs.",
		});
		for (const p of programs) {
			out.push({
				role: "program_admin",
				program: p,
				label: `${programLabel(p)} Admin`,
				description: `Every TAG in ${programLabel(p)}; can make TAG admins there.`,
			});
		}
	}
	if (targetTagId) {
		for (const p of programs) {
			const allowed =
				isInstitution ||
				hasRole(caller, "program_admin", p) ||
				(targetTagId === callerTagId && hasRole(caller, "tag_admin", p, callerTagId));
			if (allowed) {
				out.push({
					role: "tag_admin",
					program: p,
					label: `${programLabel(p)} TAG Admin`,
					description: `Runs ${programLabel(p)} reviews, rubrics and assignments for this TAG.`,
				});
			}
		}
	}
	return out;
}

/**
 * Whether the caller may reset the password of a user. Institution admins:
 * anyone. Program admins: anyone who is not an institution or program admin.
 * TAG admins: members of their own TAG who are not institution or program admins.
 */
export function canManageUser(
	caller: RoleRow[],
	callerTagId: string | null,
	target: { roles: RoleRow[]; tagId: string | null },
): boolean {
	if (hasRole(caller, "institution_admin")) return true;
	const targetIsSenior = target.roles.some(
		(r) => r.role === "institution_admin" || r.role === "program_admin",
	);
	if (targetIsSenior) return false;
	if (caller.some((r) => r.role === "program_admin")) return true;
	return (
		!!callerTagId && target.tagId === callerTagId && caller.some((r) => r.role === "tag_admin")
	);
}
