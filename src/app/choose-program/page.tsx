import { redirect } from "next/navigation";
import { GraduationCap, Users, User } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getProgram } from "@/lib/program";
import { PROGRAMS, isProgram } from "@/lib/programs";
import { setProgram } from "@/app/actions/program";

async function chooseProgram(formData: FormData) {
	"use server";
	const program = formData.get("program");
	if (!isProgram(program)) return;
	await setProgram(program);
	redirect("/dashboard");
}

export default async function ChooseProgramPage() {
	const supabase = await createServerSupabaseClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const current = await getProgram();

	return (
		<div className="landing-shell">
			<div className="hero-panel">
				<p className="eyebrow">TAG Panel Review</p>
				<h1 className="title-font" style={{ fontSize: "1.8rem" }}>
					Choose a program
				</h1>
				<p className="hero-copy">You can switch any time from the top bar.</p>

				<form action={chooseProgram} style={{ marginTop: "24px", display: "grid", gap: "12px" }}>
					{PROGRAMS.map(({ value, label, description }) => {
						const Icon = value === "mtech" ? User : Users;
						return (
							<button
								key={value}
								type="submit"
								name="program"
								value={value}
								className={`program-choice${current === value ? " is-current" : ""}`}
							>
								<span className="program-choice-icon">
									<Icon size={20} />
								</span>
								<span>
									<span className="program-choice-label">{label}</span>
									<span className="program-choice-description">{description}</span>
								</span>
								{current === value && (
									<span className="program-choice-badge">
										<GraduationCap size={14} /> Last used
									</span>
								)}
							</button>
						);
					})}
				</form>
			</div>
		</div>
	);
}
