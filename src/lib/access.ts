import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminScope } from "@/lib/admin-scope";
import { getProgram } from "@/lib/program";
import { buildAccess, type Access, type RoleRow } from "@/lib/roles";

/** Loads the signed-in user's roles for the active program, or null when signed out. */
export async function getAccess(supabase: SupabaseClient): Promise<Access | null> {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const [{ data: profile }, { data: roles }, program, scope] = await Promise.all([
		supabase.from("profiles").select("tag_id").eq("id", user.id).single(),
		supabase.from("user_roles").select("role, program, tag_id").eq("user_id", user.id),
		getProgram(),
		getAdminScope(),
	]);

	return buildAccess(
		user.id,
		profile?.tag_id ?? null,
		program ?? "btech",
		(roles ?? []) as RoleRow[],
		scope,
	);
}
