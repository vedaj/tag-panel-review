"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useProgram } from "@/components/ProgramContext";
import type { Review, TagReview, ReviewUnlockRequest } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Lock, Unlock, CheckCircle2, Clock, Send } from "lucide-react";

type TagReviewWithReview = TagReview & { review: Review };
type UnlockRequestRow = ReviewUnlockRequest & { review: Review };

export default function TagReviewsPage() {
	const supabase = createClient();
	const program = useProgram();
	const [tagId, setTagId] = useState<string | null>(null);
	const [tagReviews, setTagReviews] = useState<TagReviewWithReview[]>([]);
	const [unlockRequests, setUnlockRequests] = useState<UnlockRequestRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);
	const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
	const [requestReason, setRequestReason] = useState<Record<string, string>>({});
	const [showRequestForm, setShowRequestForm] = useState<Record<string, boolean>>({});

	useEffect(() => {
		loadData();
	}, [program]); // eslint-disable-line react-hooks/exhaustive-deps

	async function loadData() {
		setLoading(true);
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		const { data: profile } = await supabase
			.from("profiles")
			.select("tag_id")
			.eq("id", user.id)
			.single();
		const tid = profile?.tag_id ?? null;
		setTagId(tid);
		if (!tid) {
			setLoading(false);
			return;
		}

		const [{ data: tr }, { data: ur }] = await Promise.all([
			supabase
				.from("tag_reviews")
				.select("*, review:review_id!inner(*)")
				.eq("tag_id", tid)
				.eq("review.program", program)
				.order("created_at"),
			supabase
				.from("review_unlock_requests")
				.select("*, review:review_id!inner(*)")
				.eq("tag_id", tid)
				.eq("review.program", program)
				.order("created_at", { ascending: false }),
		]);

		setTagReviews((tr ?? []) as TagReviewWithReview[]);
		setUnlockRequests((ur ?? []) as UnlockRequestRow[]);
		setLoading(false);
	}

	async function activateReview(tagReviewId: string) {
		setSaving(tagReviewId);
		const {
			data: { user },
		} = await supabase.auth.getUser();
		const expires = expiryDates[tagReviewId] || null;
		await supabase
			.from("tag_reviews")
			.update({
				status: "active",
				activated_at: new Date().toISOString(),
				activated_by: user?.id,
				expires_at: expires ? new Date(expires).toISOString() : null,
				locked_at: null,
				locked_by: null,
			})
			.eq("id", tagReviewId);
		await loadData();
		setSaving(null);
	}

	async function sendUnlockRequest(tagReviewId: string, reviewId: string) {
		if (!tagId) return;
		setSaving(tagReviewId);
		const {
			data: { user },
		} = await supabase.auth.getUser();
		const reason = requestReason[tagReviewId] ?? "";
		await supabase.from("review_unlock_requests").insert({
			tag_id: tagId,
			review_id: reviewId,
			requested_by: user?.id,
			reason: reason || null,
		});
		setShowRequestForm((prev) => ({ ...prev, [tagReviewId]: false }));
		setRequestReason((prev) => ({ ...prev, [tagReviewId]: "" }));
		await loadData();
		setSaving(null);
	}

	const statusBadge = (status: string) => {
		if (status === "active")
			return (
				<Badge
					style={{ background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }}
					className="gap-1"
				>
					<CheckCircle2 size={11} />
					Active
				</Badge>
			);
		if (status === "locked")
			return (
				<Badge
					style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
					className="gap-1"
				>
					<Lock size={11} />
					Locked
				</Badge>
			);
		return (
			<Badge variant="secondary" className="gap-1">
				<Clock size={11} />
				Upcoming
			</Badge>
		);
	};

	if (loading)
		return (
			<div className="flex items-center justify-center h-64">
				<Loader2 className="animate-spin text-muted-foreground" />
			</div>
		);
	if (!tagId)
		return (
			<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
				No TAG associated with your account.
			</div>
		);

	return (
		<div className="p-6 md:p-8 pt-20 md:pt-8 max-w-3xl">
			<div className="flex items-center justify-between mb-6">
				<div>
					<p className="eyebrow mb-1">Admin</p>
					<h1
						style={{
							margin: 0,
							fontFamily: "var(--title-font)",
							fontSize: "1.8rem",
							letterSpacing: "-0.03em",
							color: "var(--app-hero-text)",
						}}
					>
						Reviews
					</h1>
					<p style={{ color: "var(--app-hero-subtext)", fontSize: "0.88rem", marginTop: 4 }}>
						Activate reviews and set deadlines for your TAG.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={loadData} className="gap-2">
					<RefreshCw size={14} />
					Refresh
				</Button>
			</div>

			{tagReviews.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center text-muted-foreground">
						No reviews created yet. Ask the institution admin to create a review.
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{tagReviews.map((tr) => {
						const pendingRequest = unlockRequests.find(
							(u) => u.review_id === tr.review_id && u.status === "pending",
						);
						const latestRequest = unlockRequests.find((u) => u.review_id === tr.review_id);

						return (
							<Card key={tr.id}>
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<div>
											<CardTitle className="text-base flex items-center gap-2">
												{statusBadge(tr.status)}
												{tr.review?.name}
											</CardTitle>
											{tr.expires_at && (
												<CardDescription className="mt-1">
													Deadline:{" "}
													{new Date(tr.expires_at).toLocaleDateString("en-IN", {
														day: "numeric",
														month: "short",
														year: "numeric",
													})}
													{new Date(tr.expires_at) < new Date() && (
														<span className="ml-2 text-destructive font-medium">· Expired</span>
													)}
												</CardDescription>
											)}
											{latestRequest && latestRequest.status !== "pending" && (
												<CardDescription className="mt-1">
													Unlock request:{" "}
													<span
														className={
															latestRequest.status === "approved"
																? "text-green-600"
																: "text-destructive"
														}
													>
														{latestRequest.status}
													</span>
												</CardDescription>
											)}
										</div>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									{tr.status === "upcoming" && (
										<div className="flex flex-wrap items-end gap-3">
											<div>
												<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
													Expiry Date (optional)
												</label>
												<input
													type="date"
													value={expiryDates[tr.id] ?? ""}
													onChange={(e) =>
														setExpiryDates((prev) => ({ ...prev, [tr.id]: e.target.value }))
													}
													style={{
														padding: "6px 10px",
														borderRadius: 8,
														border: "1px solid hsl(var(--border))",
														background: "hsl(var(--background))",
														color: "hsl(var(--foreground))",
														fontSize: "0.875rem",
													}}
												/>
											</div>
											<Button
												size="sm"
												disabled={saving === tr.id}
												onClick={() => activateReview(tr.id)}
												className="gap-1"
												style={{ background: "#16a34a", color: "#fff" }}
											>
												{saving === tr.id ? (
													<Loader2 size={13} className="animate-spin" />
												) : (
													<>
														<Unlock size={13} />
														Activate
													</>
												)}
											</Button>
										</div>
									)}

									{tr.status === "active" && (
										<div className="flex flex-wrap items-end gap-3">
											<div>
												<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
													Update Expiry
												</label>
												<input
													type="date"
													value={
														expiryDates[tr.id] ?? (tr.expires_at ? tr.expires_at.slice(0, 10) : "")
													}
													onChange={(e) =>
														setExpiryDates((prev) => ({ ...prev, [tr.id]: e.target.value }))
													}
													style={{
														padding: "6px 10px",
														borderRadius: 8,
														border: "1px solid hsl(var(--border))",
														background: "hsl(var(--background))",
														color: "hsl(var(--foreground))",
														fontSize: "0.875rem",
													}}
												/>
											</div>
											<Button
												size="sm"
												variant="outline"
												disabled={saving === tr.id}
												onClick={async () => {
													setSaving(tr.id);
													await supabase
														.from("tag_reviews")
														.update({
															expires_at: expiryDates[tr.id]
																? new Date(expiryDates[tr.id]).toISOString()
																: tr.expires_at,
														})
														.eq("id", tr.id);
													await loadData();
													setSaving(null);
												}}
											>
												Update deadline
											</Button>
										</div>
									)}

									{tr.status === "locked" && !pendingRequest && (
										<div>
											{showRequestForm[tr.id] ? (
												<div className="space-y-2">
													<textarea
														placeholder="Reason for unlock request (optional)"
														value={requestReason[tr.id] ?? ""}
														onChange={(e) =>
															setRequestReason((prev) => ({ ...prev, [tr.id]: e.target.value }))
														}
														rows={2}
														style={{
															width: "100%",
															padding: "8px 10px",
															borderRadius: 8,
															border: "1px solid hsl(var(--border))",
															background: "hsl(var(--background))",
															color: "hsl(var(--foreground))",
															fontSize: "0.875rem",
															resize: "vertical",
														}}
													/>
													<div className="flex gap-2">
														<Button
															size="sm"
															disabled={saving === tr.id}
															onClick={() => sendUnlockRequest(tr.id, tr.review_id)}
															className="gap-1"
														>
															{saving === tr.id ? (
																<Loader2 size={13} className="animate-spin" />
															) : (
																<>
																	<Send size={13} />
																	Send Request
																</>
															)}
														</Button>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																setShowRequestForm((prev) => ({ ...prev, [tr.id]: false }))
															}
														>
															Cancel
														</Button>
													</div>
												</div>
											) : (
												<Button
													size="sm"
													variant="outline"
													onClick={() => setShowRequestForm((prev) => ({ ...prev, [tr.id]: true }))}
													className="gap-1"
												>
													<Unlock size={13} />
													Request Unlock
												</Button>
											)}
										</div>
									)}

									{tr.status === "locked" && pendingRequest && (
										<p className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
											<Clock size={13} /> Unlock request pending institution admin approval
										</p>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
