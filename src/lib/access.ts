import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getProgram } from "@/lib/program";
import { ACTING_COOKIE, buildAccess, type Access, type RoleRow } from "@/lib/roles";

/** Loads the signed-in user's roles and acting role for the active program, or null when signed out. */
export async function getAccess(supabase: SupabaseClient): Promise<Access | null> {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const [{ data: profile }, { data: roles }, program, jar] = await Promise.all([
		supabase.from("profiles").select("tag_id").eq("id", user.id).single(),
		supabase.from("user_roles").select("role, program, tag_id").eq("user_id", user.id),
		getProgram(),
		cookies(),
	]);

	return buildAccess(
		user.id,
		profile?.tag_id ?? null,
		program ?? "btech",
		(roles ?? []) as RoleRow[],
		jar.get(ACTING_COOKIE)?.value,
	);
}
