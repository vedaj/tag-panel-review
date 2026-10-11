import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getAccess } from "@/lib/access";
import { getActiveTagReview } from "@/lib/review";
import { redirect } from "next/navigation";
import AnalyticsClient from "@/components/analytics/AnalyticsClient";
import InstitutionAnalyticsClient, {
	type TagAnalyticsData,
} from "@/components/analytics/InstitutionAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string>>;
}) {
	const supabase = await createServerSupabaseClient();
	const params = await searchParams;
	const access = await getAccess(supabase);
	if (!access) redirect("/login");
	const user = { id: access.userId };

	const { data: profile } = await supabase
		.from("profiles")
		.select("*, tag:tags(*)")
		.eq("id", user.id)
		.single();
	const isAdmin = access.isAdmin;
	const tagId = access.tagFilter;
	const program = access.program;

	// Institution / program admin viewing every TAG → cross-TAG analytics
	if (access.isInstitutionAdmin || access.isProgramAdmin) {
		if (!tagId) {
			const admin = createAdminSupabaseClient();
			const [{ data: tags }, { data: profiles }, { data: groups }, { data: grades }] =
				await Promise.all([
					admin.from("tags").select("*").order("short_name"),
					admin.from("profiles").select("id, tag_id"),
					admin.from("groups").select("id, tag_id, students(id)").eq("program", program),
					admin.from("grades").select("student_id, faculty_id").gt("marks", 0),
				]);

			const gradedStudentSet = new Set(
				(grades ?? []).map((g: { student_id: string }) => g.student_id),
			);
			const gradingFacultyByTag: Record<string, Set<string>> = {};

			const studentTagMap = new Map<string, string>();
			for (const group of groups ?? []) {
				if (!group.tag_id) continue;
				for (const student of (group.students ?? []) as { id: string }[]) {
					studentTagMap.set(student.id, group.tag_id);
				}
			}

			const facultyTagMap = new Map<string, string>();
			for (const p of profiles ?? []) {
				if (p.tag_id) facultyTagMap.set(p.id, p.tag_id);
			}

			for (const tag of tags ?? []) {
				gradingFacultyByTag[tag.id] = new Set();
			}
			for (const grade of grades ?? []) {
				// Only count grading of this program's students
				if (!studentTagMap.has(grade.student_id)) continue;
				const tagId2 = facultyTagMap.get(grade.faculty_id);
				if (tagId2 && gradingFacultyByTag[tagId2]) {
					gradingFacultyByTag[tagId2].add(grade.faculty_id);
				}
			}

			const tagData: TagAnalyticsData[] = (tags ?? []).map((tag) => {
				const tagProfiles = (profiles ?? []).filter(
					(p: { tag_id: string | null }) => p.tag_id === tag.id,
				);
				const tagGroups = (groups ?? []).filter(
					(g: { tag_id: string | null }) => g.tag_id === tag.id,
				);
				const allStudents = tagGroups.flatMap((g) => (g.students ?? []) as { id: string }[]);
				const studentCount = allStudents.length;
				const gradedCount = allStudents.filter((s) => gradedStudentSet.has(s.id)).length;
				// Every member is faculty, admins included
				const facultyCount = tagProfiles.length;
				const facultyGrading = gradingFacultyByTag[tag.id]?.size ?? 0;
				const pct = studentCount > 0 ? Math.round((gradedCount / studentCount) * 100) : 0;
				return {
					id: tag.id,
					short_name: tag.short_name,
					name: tag.name,
					pct,
					students: studentCount,
					graded: gradedCount,
					groups: tagGroups.length,
					faculty: facultyCount,
					faculty_grading: facultyGrading,
					faculty_pct: facultyCount > 0 ? Math.round((facultyGrading / facultyCount) * 100) : 0,
				};
			});

			return <InstitutionAnalyticsClient tags={tagData} />;
		}
	}

	// ── Review selection ────────────────────────────────────────────────────────
	const { data: reviewsList } = await supabase
		.from("reviews")
		.select("id, name, order_index")
		.eq("program", program)
		.order("order_index");
	const activeReview = tagId ? await getActiveTagReview(supabase, tagId, program) : null;
	// A reviewId left in the URL from the other program is ignored
	const requestedReviewId = (reviewsList ?? []).some((r) => r.id === params.reviewId)
		? params.reviewId
		: null;
	const selectedReviewId =
		requestedReviewId || activeReview?.reviewId || (reviewsList ?? [])[0]?.id || null;

	// ── Data queries ─────────────────────────────────────────────────────────────

	let groupsQuery = supabase.from("groups").select("*").eq("program", program).order("name");
	if (tagId) groupsQuery = groupsQuery.eq("tag_id", tagId);

	// Panel criteria for existing analytics sections
	let criteriaQuery = supabase
		.from("criteria")
		.select("*, sub_criteria(*)")
		.eq("review_type", "panel")
		.order("order_index");
	if (selectedReviewId) criteriaQuery = criteriaQuery.eq("review_id", selectedReviewId);
	if (tagId) criteriaQuery = criteriaQuery.or(`tag_id.is.null,tag_id.eq.${tagId}`);

	// Guide criteria for review analytics section
	let guideCriteriaQuery = supabase
		.from("criteria")
		.select("*, sub_criteria(*)")
		.eq("review_type", "guide")
		.order("order_index");
	if (selectedReviewId) guideCriteriaQuery = guideCriteriaQuery.eq("review_id", selectedReviewId);
	if (tagId) guideCriteriaQuery = guideCriteriaQuery.or(`tag_id.is.null,tag_id.eq.${tagId}`);

	let profilesQuery = supabase.from("profiles").select("*").order("name");
	if (tagId) profilesQuery = profilesQuery.eq("tag_id", tagId);

	// Grades scoped to the selected review
	let myGradesQuery = supabase.from("grades").select("*").eq("faculty_id", user.id).gt("marks", 0);
	if (selectedReviewId) myGradesQuery = myGradesQuery.eq("review_id", selectedReviewId);

	let allGradesQuery = supabase.from("grades").select("*").gt("marks", 0).limit(200000);
	if (selectedReviewId) allGradesQuery = allGradesQuery.eq("review_id", selectedReviewId);

	// Group review statuses for selected review
	const grsPromise =
		isAdmin && selectedReviewId
			? supabase.from("group_review_status").select("*").eq("review_id", selectedReviewId)
			: Promise.resolve({ data: [] });

	const [
		{ data: groups },
		{ data: students },
		{ data: criteria },
		{ data: guideCriteria },
		{ data: myGrades },
		{ data: allGrades },
		{ data: profiles },
		{ data: groupReviewStatuses },
	] = await Promise.all([
		groupsQuery,
		supabase.from("students").select("*, group:groups!inner(program)").eq("group.program", program),
		criteriaQuery,
		isAdmin ? guideCriteriaQuery : Promise.resolve({ data: [] }),
		myGradesQuery,
		isAdmin ? allGradesQuery : Promise.resolve({ data: [] }),
		isAdmin ? profilesQuery : Promise.resolve({ data: [] }),
		grsPromise,
	]);

	return (
		<AnalyticsClient
			isAdmin={isAdmin}
			facultyId={user.id}
			facultyName={profile?.name ?? ""}
			groups={groups ?? []}
			students={students ?? []}
			criteria={criteria ?? []}
			guideCriteria={(guideCriteria ?? []) as NonNullable<typeof guideCriteria>}
			myGrades={myGrades ?? []}
			allGrades={(allGrades ?? []) as NonNullable<typeof allGrades>}
			profiles={(profiles ?? []) as NonNullable<typeof profiles>}
			reviews={reviewsList ?? []}
			selectedReviewId={selectedReviewId}
			groupReviewStatuses={(groupReviewStatuses ?? []) as NonNullable<typeof groupReviewStatuses>}
		/>
	);
}
