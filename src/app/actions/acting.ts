"use server";
import { cookies } from "next/headers";
import { ACTING_COOKIE, type ActingRole } from "@/lib/roles";

/** Remembers which of their roles the user is acting as (checked again in buildAccess). */
export async function setActingRole(role: ActingRole) {
	if (!["institution", "program", "tag", "faculty"].includes(role)) throw new Error("Unknown role");
	const jar = await cookies();
	jar.set(ACTING_COOKIE, role, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
