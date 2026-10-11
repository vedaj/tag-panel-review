import { cookies } from "next/headers";

export type AdminScope = "institution" | "tag";

export async function getAdminScope(): Promise<AdminScope> {
	const jar = await cookies();
	const v = jar.get("tag:scope")?.value;
	return v === "tag" ? "tag" : "institution";
}
