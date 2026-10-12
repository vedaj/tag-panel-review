import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DashboardShell } from "@/components/DashboardShell";
import type { Tag } from "@/types/database";
import { getProgram } from "@/lib/program";
import { getAccess } from "@/lib/access";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const program = await getProgram();
	if (!program) {
		redirect("/choose-program");
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("*, tag:tags(*)")
		.eq("id", user.id)
		.single();

	const { data: tags } = (await supabase.from("tags").select("*").order("name")) as {
		data: Tag[] | null;
	};

	const access = await getAccess(supabase);
	if (!access) redirect("/login");

	return (
		<DashboardShell profile={profile} tags={tags ?? []} program={program} access={access}>
			{children}
		</DashboardShell>
	);
}
