export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import TagManager from "@/components/institution/TagManager";
import type { Tag, Profile } from "@/types/database";

interface TagWithMembers extends Tag {
	members: Profile[];
	groupCount: number;
}

export default async function InstitutionPage() {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.single();
	if (profile?.role !== "institution_admin") redirect("/dashboard");

	const admin = createAdminSupabaseClient();
	const [{ data: tags }, { data: profiles }, { data: groups }] = await Promise.all([
		admin.from("tags").select("*").order("short_name"),
		admin.from("profiles").select("*").order("name"),
		admin.from("groups").select("id, tag_id"),
	]);

	const groupCountByTag = ((groups ?? []) as { id: string; tag_id: string | null }[]).reduce<
		Record<string, number>
	>((acc, g) => {
		if (g.tag_id) acc[g.tag_id] = (acc[g.tag_id] ?? 0) + 1;
		return acc;
	}, {});

	const tagsWithMembers: TagWithMembers[] = (tags ?? []).map((tag) => ({
		...tag,
		members: ((profiles ?? []) as Profile[]).filter((p) => p.tag_id === tag.id),
		groupCount: groupCountByTag[tag.id] ?? 0,
	}));

	return <TagManager tags={tagsWithMembers} allProfiles={(profiles ?? []) as Profile[]} />;
}
