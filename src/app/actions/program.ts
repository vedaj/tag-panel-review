"use server";
import { cookies } from "next/headers";
import type { Program } from "@/types/database";
import { PROGRAM_COOKIE, isProgram } from "@/lib/programs";

export async function setProgram(program: Program) {
	if (!isProgram(program)) throw new Error("Unknown program");
	const jar = await cookies();
	jar.set(PROGRAM_COOKIE, program, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
