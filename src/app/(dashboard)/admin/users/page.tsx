export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getAccess } from "@/lib/access";
import { canManageUser, type RoleRow } from "@/lib/roles";
import { isProgram } from "@/lib/programs";
import { UsersClient } from "@/components/admin/UsersClient";
import type { AdminRole } from "@/types/database";

export type UserRow = {
	id: string;
	name: string;
	email: string;
	roles: RoleRow[];
	tag_id: string | null;
	tag_short_name: string | null;
	created_at: string;
	last_sign_in_at: string | null;
};

export type TagOption = { id: string; short_name: string; name: string };

/** The caller's access; throws unless they are an admin in the active program. */
async function requireAdmin() {
	const supabase = await createServerSupabaseClient();
	const access = await getAccess(supabase);
	if (!access) throw new Error("Not authenticated");
	if (!access.isAdmin) throw new Error("Forbidden");
	return { supabase, access };
}

/** Throws unless the caller may reset the password of / delete this user. */
async function requireCanManage(userId: string) {
	const { access } = await requireAdmin();
	const admin = createAdminSupabaseClient();
	const [{ data: target }, { data: roles }] = await Promise.all([
		admin.from("profiles").select("tag_id").eq("id", userId).maybeSingle(),
		admin.from("user_roles").select("role, program, tag_id").eq("user_id", userId),
	]);
	const allowed = canManageUser(access.roles, access.tagId, {
		roles: (roles ?? []) as RoleRow[],
		tagId: target?.tag_id ?? null,
	});
	if (!allowed) throw new Error("Forbidden");
	return { access, admin };
}

async function createUser(formData: FormData) {
	"use server";
	const { supabase, access } = await requireAdmin();
	if (!access.isInstitutionAdmin) throw new Error("Only institution admins can add users");

	const name = formData.get("name") as string;
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const makeTagAdmin = formData.get("tag_admin") === "on";
	// Only institution admins choose the TAG; everyone else adds to their own
	const tagId = access.isInstitutionAdmin
		? (formData.get("tag_id") as string) || access.tagId
		: access.tagId;
	if (!tagId) throw new Error("Pick a TAG for the new user");

	const admin = createAdminSupabaseClient();
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { name },
	});
	if (error) throw error;

	await admin.from("profiles").upsert({ id: data.user.id, name, email, tag_id: tagId });

	if (makeTagAdmin) {
		// The caller's session, so the database checks they may grant it
		const { error: roleErr } = await supabase.rpc("grant_role", {
			target: data.user.id,
			r: "tag_admin",
			p: access.program,
		});
		if (roleErr) throw new Error(`User created, but not made TAG admin: ${roleErr.message}`);
	}
}

/** Grants or revokes one role. grant_role / revoke_role decide who may. */
async function setRole(formData: FormData) {
	"use server";
	const { supabase } = await requireAdmin();

	const userId = formData.get("userId") as string;
	const role = formData.get("role") as AdminRole;
	const program = formData.get("program") || null;
	const grant = formData.get("grant") === "true";
	if (program !== null && !isProgram(program)) throw new Error("Unknown program");

	const { error } = await supabase.rpc(grant ? "grant_role" : "revoke_role", {
		target: userId,
		r: role,
		p: program,
	});
	if (error) throw new Error(error.message);
}

async function moveToTag(formData: FormData) {
	"use server";
	const { access } = await requireAdmin();
	if (!access.isInstitutionAdmin && !access.isProgramAdmin) {
		throw new Error("Only institution and program admins can move users between TAGs");
	}

	const userId = formData.get("userId") as string;
	const tagId = formData.get("tag_id") as string;

	const admin = createAdminSupabaseClient();
	// Moving ends their TAG-admin roles in the old TAG (database trigger)
	const { error } = await admin.from("profiles").update({ tag_id: tagId }).eq("id", userId);
	if (error) throw new Error(error.message);
}

async function setPassword(formData: FormData) {
	"use server";
	const userId = formData.get("userId") as string;
	const password = formData.get("password") as string;

	const { admin } = await requireCanManage(userId);
	const { error } = await admin.auth.admin.updateUserById(userId, { password });
	if (error) throw error;
}

async function deleteUser(formData: FormData) {
	"use server";
	const userId = formData.get("userId") as string;

	const { access, admin } = await requireCanManage(userId);
	if (!access.isInstitutionAdmin) throw new Error("Only institution admins can remove users");
	if (userId === access.userId) throw new Error("Cannot delete yourself");

	await admin.auth.admin.deleteUser(userId);
	await admin.from("profiles").delete().eq("id", userId);
}

export default async function UsersPage() {
	const supabase = await createServerSupabaseClient();
	const access = await getAccess(supabase);
	if (!access) redirect("/login");
	if (!access.isAdmin) redirect("/dashboard");

	const tagFilter = access.tagFilter;

	const admin = createAdminSupabaseClient();
	const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });

	let profilesQuery = admin.from("profiles").select("*, tag:tags(short_name, name)");
	if (tagFilter) profilesQuery = profilesQuery.eq("tag_id", tagFilter);
	const [{ data: profiles }, { data: allRoles }, { data: allTags }] = await Promise.all([
		profilesQuery,
		admin.from("user_roles").select("user_id, role, program, tag_id"),
		admin.from("tags").select("id, short_name, name").order("short_name"),
	]);

	const rolesByUser = new Map<string, RoleRow[]>();
	for (const r of (allRoles ?? []) as (RoleRow & { user_id: string })[]) {
		const list = rolesByUser.get(r.user_id) ?? [];
		list.push({ role: r.role, program: r.program, tag_id: r.tag_id });
		rolesByUser.set(r.user_id, list);
	}

	const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

	const authIds = new Set((authData?.users ?? []).map((u) => u.id));

	const users: UserRow[] = (profiles ?? [])
		.filter((p) => authIds.has(p.id))
		.map((p) => {
			const authUser = (authData?.users ?? []).find((u) => u.id === p.id);
			return {
				id: p.id,
				name: p.name ?? "",
				email: p.email ?? "",
				roles: rolesByUser.get(p.id) ?? [],
				tag_id: p.tag_id ?? null,
				tag_short_name: (p.tag as { short_name?: string } | null)?.short_name ?? null,
				created_at: authUser?.created_at ?? p.created_at,
				last_sign_in_at: authUser?.last_sign_in_at ?? null,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	// Include auth users not yet in profiles (in case trigger didn't fire)
	for (const au of authData?.users ?? []) {
		if (!profileMap.has(au.id) && !tagFilter) {
			users.push({
				id: au.id,
				name: au.user_metadata?.name ?? "",
				email: au.email ?? "",
				roles: [],
				tag_id: null,
				tag_short_name: null,
				created_at: au.created_at,
				last_sign_in_at: au.last_sign_in_at ?? null,
			});
		}
	}

	return (
		<UsersClient
			users={users}
			tags={(allTags ?? []) as TagOption[]}
			createUser={createUser}
			setRole={setRole}
			moveToTag={moveToTag}
			setPassword={setPassword}
			deleteUser={deleteUser}
		/>
	);
}
