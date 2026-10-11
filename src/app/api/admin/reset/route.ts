import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getAccess } from "@/lib/access";

// Keeps .in() filters short enough for the request URL
function chunks<T>(items: T[], size = 200): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

export async function POST(req: NextRequest) {
	const supabase = await createServerSupabaseClient();
	const access = await getAccess(supabase);
	if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!access.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const { clearType } = (await req.json()) as { clearType: boolean };
	const program = access.program;
	const admin = createAdminSupabaseClient();

	// Same scope as the page: every TAG in the program for institution / program
	// admins viewing all TAGs, otherwise only the user's own TAG
	const tagId = access.tagFilter;
	if (!access.isInstitutionAdmin && !access.isProgramAdmin && !tagId) {
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
