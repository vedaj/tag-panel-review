import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getProgram } from "@/lib/program";

// Keeps .in() filters short enough for the request URL
function chunks<T>(items: T[], size = 200): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

export async function POST(req: NextRequest) {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { data: profile } = await supabase
		.from("profiles")
		.select("role, tag_id")
		.eq("id", user.id)
		.single();

	if (!profile || !["admin", "institution_admin"].includes(profile.role)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { clearType } = (await req.json()) as { clearType: boolean };
	const program = (await getProgram()) ?? "btech";
	const admin = createAdminSupabaseClient();

	const isInstitutionAdmin = profile.role === "institution_admin";
	const tagId: string | null = isInstitutionAdmin ? null : (profile.tag_id ?? null);
	if (!isInstitutionAdmin && !tagId) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	// Only the active program's groups (and, for TAG admins, only their TAG)
	let groupsQuery = admin.from("groups").select("id").eq("program", program);
	if (tagId) groupsQuery = groupsQuery.eq("tag_id", tagId);
	const { data: groups } = await groupsQuery;
	const groupIds = (groups ?? []).map((g: { id: string }) => g.id);

	for (const ids of chunks(groupIds)) {
		const { data: students } = await admin.from("students").select("id").in("group_id", ids);
		const studentIds = (students ?? []).map((s: { id: string }) => s.id);
		for (const sIds of chunks(studentIds)) {
			await admin.from("grades").delete().in("student_id", sIds);
		}
		await admin.from("feedback").delete().in("group_id", ids);
		if (clearType) {
			await admin.from("groups").update({ project_type: "" }).in("id", ids);
		}
	}

	return NextResponse.json({ success: true });
}
