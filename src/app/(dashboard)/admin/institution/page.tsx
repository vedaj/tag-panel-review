export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import TagManager from "@/components/institution/TagManager";
import { getAccess } from "@/lib/access";
import type { Tag, Profile } from "@/types/database";

interface TagWithMembers extends Tag {
	members: Profile[];
	groupCount: number;
}

export default async function InstitutionPage() {
	const supabase = await createServerSupabaseClient();
	const access = await getAccess(supabase);
	if (!access) redirect("/login");
	if (!access.isInstitutionAdmin) redirect("/dashboard");

	const program = access.program;
	const admin = createAdminSupabaseClient();
	const [{ data: tags }, { data: profiles }, { data: groups }, { data: roles }] = await Promise.all(
		[
			admin.from("tags").select("*").order("short_name"),
			admin.from("profiles").select("*").order("name"),
			admin.from("groups").select("id, tag_id").eq("program", program),
			admin.from("user_roles").select("user_id, role, program"),
		],
	);
	const roleRows = (roles ?? []) as { user_id: string; role: string; program: string | null }[];
	const tagAdminIds = roleRows
		.filter((r) => r.role === "tag_admin" && r.program === program)
		.map((r) => r.user_id);
	const institutionAdminIds = roleRows
		.filter((r) => r.role === "institution_admin")
		.map((r) => r.user_id);

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

	return (
		<TagManager
			tags={tagsWithMembers}
			allProfiles={(profiles ?? []) as Profile[]}
			tagAdminIds={tagAdminIds}
			institutionAdminIds={institutionAdminIds}
		/>
	);
}
