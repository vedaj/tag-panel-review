import type { SupabaseClient } from "@supabase/supabase-js";
import type { Program, TagReview } from "@/types/database";

export interface ActiveReviewInfo {
	reviewId: string;
	reviewName: string;
	orderIndex: number;
	isLocked: boolean;
	expiresAt: string | null;
	tagReviewId: string;
}

/**
 * Returns all active (and optionally upcoming) tag_reviews for a given TAG and program.
 * Used by server pages to determine what review is currently in play.
 */
export async function getTagReviews(
	supabase: SupabaseClient,
	tagId: string,
	program: Program,
): Promise<TagReview[]> {
	const { data } = await supabase
		.from("tag_reviews")
		.select("*, review:review_id!inner(id, name, order_index, created_at, program)")
		.eq("tag_id", tagId)
		.eq("review.program", program)
		.order("created_at");
	return (data ?? []) as TagReview[];
}

/**
 * Returns the single active review for a TAG in a program, or null if none.
 * If multiple are active (edge case: unlock of older review), returns the latest by order_index.
 */
export async function getActiveTagReview(
	supabase: SupabaseClient,
	tagId: string,
	program: Program,
): Promise<ActiveReviewInfo | null> {
	const { data } = await supabase
		.from("tag_reviews")
		.select("*, review:review_id!inner(id, name, order_index, program)")
		.eq("tag_id", tagId)
		.eq("review.program", program)
		.eq("status", "active")
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!data) return null;

	const review = data.review as { id: string; name: string; order_index: number };
	return {
		reviewId: review.id,
		reviewName: review.name,
		orderIndex: review.order_index,
		isLocked: false,
		expiresAt: data.expires_at,
		tagReviewId: data.id,
	};
}

/**
 * Checks if a tag_review is expired and should be auto-locked.
 * Returns true if expires_at is in the past.
 */
export function isExpired(expiresAt: string | null): boolean {
	if (!expiresAt) return false;
	return new Date(expiresAt) < new Date();
}
