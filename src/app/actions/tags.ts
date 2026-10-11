"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { isProgram } from "@/lib/programs";
import type { Program } from "@/types/database";

async function assertInstitutionAdmin() {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Unauthenticated");
	const { data: role } = await supabase
		.from("user_roles")
		.select("id")
		.eq("user_id", user.id)
		.eq("role", "institution_admin")
		.maybeSingle();
	if (!role) throw new Error("Unauthorized");
	return { supabase, admin: createAdminSupabaseClient() };
}

export async function createTagAction(name: string, shortName: string) {
	const { admin } = await assertInstitutionAdmin();
	const { data: tag, error } = await admin
		.from("tags")
		.insert({ name: name.trim(), short_name: shortName.trim().toUpperCase() })
		.select()
		.single();
	if (error || !tag) return { error: error?.message ?? "Failed to create TAG" };
	// Seed tag_reviews for every existing review (both programs) as 'upcoming'
	const { data: reviews } = await admin.from("reviews").select("id");
	if (reviews && reviews.length > 0) {
		await admin
			.from("tag_reviews")
			.insert(reviews.map((r) => ({ tag_id: tag.id, review_id: r.id, status: "upcoming" })));
	}
	return { success: true };
}

export async function updateTagAction(id: string, name: string, shortName: string) {
	const { admin } = await assertInstitutionAdmin();
	const { error } = await admin
		.from("tags")
		.update({ name: name.trim(), short_name: shortName.trim().toUpperCase() })
		.eq("id", id);
	return error ? { error: error.message } : { success: true };
}

export async function deleteTagAction(id: string) {
	const { admin } = await assertInstitutionAdmin();
	// Foreign keys unassign its members, groups and criteria and remove its TAG-admin roles
	const { error } = await admin.from("tags").delete().eq("id", id);
	return error ? { error: error.message } : { success: true };
}

export async function assignMemberToTagAction(profileId: string, tagId: string) {
	const { admin } = await assertInstitutionAdmin();
	// Moving to another TAG ends TAG-admin roles in the old one (database trigger)
	const { error } = await admin.from("profiles").update({ tag_id: tagId }).eq("id", profileId);
	return error ? { error: error.message } : { success: true };
}

export async function removeMemberFromTagAction(profileId: string) {
	const { admin } = await assertInstitutionAdmin();
	const { error } = await admin.from("profiles").update({ tag_id: null }).eq("id", profileId);
	return error ? { error: error.message } : { success: true };
}

/** Makes a member TAG admin of their TAG in one program (checked again by grant_role). */
export async function elevateToAdminAction(profileId: string, program: Program) {
	if (!isProgram(program)) return { error: "Unknown program" };
	const { supabase } = await assertInstitutionAdmin();
	const { error } = await supabase.rpc("grant_role", {
		target: profileId,
		r: "tag_admin",
		p: program,
	});
	return error ? { error: error.message } : { success: true };
}

export async function demoteToFacultyAction(profileId: string, program: Program) {
	if (!isProgram(program)) return { error: "Unknown program" };
	const { supabase } = await assertInstitutionAdmin();
	const { error } = await supabase.rpc("revoke_role", {
		target: profileId,
		r: "tag_admin",
		p: program,
	});
	return error ? { error: error.message } : { success: true };
}
