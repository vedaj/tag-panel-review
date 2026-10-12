import type { AdminRole, Program, UserRole } from "@/types/database";
import { programLabel } from "@/lib/programs";

/** The admin role rows a check needs (a subset of UserRole). */
export type RoleRow = Pick<UserRole, "role" | "program" | "tag_id">;

/** What the signed-in user may do in the active program. Serializable, so it can go to client components. */
export interface Access {
	userId: string;
	/** The user's home TAG */
	tagId: string | null;
	program: Program;
	roles: RoleRow[];
	isInstitutionAdmin: boolean;
	/** B.Tech Admin / M.Tech Admin for the active program */
	isProgramAdmin: boolean;
	/** TAG admin of their home TAG in the active program */
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

export function roleLabel(roles: RoleRow[], program: Program): string {
	const p = programLabel(program);
	if (hasRole(roles, "institution_admin")) return "Institution Admin";
	if (hasRole(roles, "program_admin", program)) return `${p} Admin`;
	if (roles.some((r) => r.role === "tag_admin" && r.program === program)) return `${p} TAG Admin`;
	return "Faculty";
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
 * Builds Access. scope is the institution/TAG view toggle: institution and
 * program admins see every TAG unless they switched to their own TAG.
 */
export function buildAccess(
	userId: string,
	tagId: string | null,
	program: Program,
	roles: RoleRow[],
	scope: "institution" | "tag",
): Access {
	const isInstitutionAdmin = hasRole(roles, "institution_admin");
	const isProgramAdmin = hasRole(roles, "program_admin", program);
	const isTagAdmin = !!tagId && hasRole(roles, "tag_admin", program, tagId);
	const seesAllTags = isInstitutionAdmin || isProgramAdmin;
	return {
		userId,
		tagId,
		program,
		roles,
		isInstitutionAdmin,
		isProgramAdmin,
		isTagAdmin,
		isAdmin: isInstitutionAdmin || isProgramAdmin || isTagAdmin,
		tagFilter: seesAllTags && scope === "institution" ? null : tagId,
		roleLabel: roleLabel(roles, program),
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
 * Whether the caller may reset the password of / delete a user. Institution
 * admins may for anyone; other admins only for members of their own TAG who
 * hold no institution or program admin role.
 */
export function canManageUser(
	caller: RoleRow[],
	callerTagId: string | null,
	target: { roles: RoleRow[]; tagId: string | null },
): boolean {
	if (hasRole(caller, "institution_admin")) return true;
	if (!callerTagId || target.tagId !== callerTagId) return false;
	const callerIsAdmin = caller.some((r) => r.role === "program_admin" || r.role === "tag_admin");
	const targetIsSenior = target.roles.some(
		(r) => r.role === "institution_admin" || r.role === "program_admin",
	);
	return callerIsAdmin && !targetIsSenior;
}
