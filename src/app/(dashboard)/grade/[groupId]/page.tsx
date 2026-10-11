export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import { GradingSheetClient } from "@/components/grading/GradingSheetClient";
import { getActiveTagReview, isExpired } from "@/lib/review";
import { canAdmin, type RoleRow } from "@/lib/roles";

interface Props {
	params: Promise<{ groupId: string }>;
}

export default async function GradePage({ params }: Props) {
	const { groupId } = await params;
	const supabase = await createServerSupabaseClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

	const { data: roles } = await supabase
		.from("user_roles")
		.select("role, program, tag_id")
		.eq("user_id", user.id);

	// Fetch group with students
	const { data: group } = await supabase
		.from("groups")
		.select("*, students(id, name, roll_number), project_type")
		.eq("id", groupId)
		.single();

	if (!group) notFound();

	// Admin of this group's program + TAG, otherwise must be on its panel
	const isAdmin = canAdmin((roles ?? []) as RoleRow[], group.program ?? "btech", group.tag_id);
	if (!isAdmin) {
		const { data: assignment } = await supabase
			.from("panel_assignments")
			.select("id")
			.eq("faculty_id", user.id)
			.eq("group_id", groupId)
			.maybeSingle();

		if (!assignment) notFound();
	}

	// Sort students by roll number
	group.students = (group.students ?? []).sort(
		(a: { roll_number: string }, b: { roll_number: string }) =>
			a.roll_number.localeCompare(b.roll_number),
	);

	// Resolve active review for this group's TAG
	const tagId = group.tag_id ?? profile?.tag_id ?? null;
	const activeReview = tagId
		? await getActiveTagReview(supabase, tagId, group.program ?? "btech")
		: null;
	const isLocked = !activeReview || isExpired(activeReview.expiresAt);
	const reviewId = activeReview?.reviewId ?? null;

	// Auto-lock expired review
	if (activeReview && isExpired(activeReview.expiresAt)) {
		await supabase
			.from("tag_reviews")
			.update({ status: "locked", locked_at: new Date().toISOString(), locked_by: null })
			.eq("id", activeReview.tagReviewId);
	}

	if (!reviewId) {
		return (
			<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
				No active review for this TAG. Ask the admin to activate a review.
			</div>
		);
	}

	// Fetch panel criteria scoped to this review
	const { data: criteria } = await supabase
		.from("criteria")
		.select(
			"*, sub_criteria(id, title, description, max_marks, order_index, allowed_marks), allowed_marks",
		)
		.eq("review_id", reviewId)
		.eq("review_type", "panel")
		.order("order_index");

	const sortedCriteria = (criteria ?? []).map((c) => ({
		...c,
		project_type: c.project_type ?? "all",
		allowed_marks: c.allowed_marks ?? "",
		sub_criteria: (c.sub_criteria ?? [])
			.sort(
				(a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index,
			)
			.map((s: { allowed_marks?: string | null; [k: string]: unknown }) => ({
				...s,
				allowed_marks: s.allowed_marks ?? "",
			})),
	}));

	// Fetch this faculty's existing grades for this group + review
	const studentIds = group.students.map((s: { id: string }) => s.id);
	const { data: existingGrades } =
		studentIds.length > 0
			? await supabase
					.from("grades")
					.select("*")
					.eq("faculty_id", user.id)
					.eq("review_id", reviewId)
					.in("student_id", studentIds)
			: { data: [] };

	// Fetch feedback scoped to this review
	const { data: existingFeedback } = await supabase
		.from("feedback")
		.select("*")
		.eq("faculty_id", user.id)
		.eq("review_id", reviewId)
		.eq("group_id", groupId);

	return (
		<GradingSheetClient
			group={group}
			criteria={sortedCriteria}
			existingGrades={existingGrades ?? []}
			existingFeedback={existingFeedback ?? []}
			facultyId={user.id}
			isAdmin={isAdmin}
			reviewId={reviewId}
			reviewName={activeReview?.reviewName ?? "Review"}
			isLocked={isLocked}
		/>
	);
}
