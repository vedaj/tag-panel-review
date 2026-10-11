import { cookies } from "next/headers";
import type { Program } from "@/types/database";
import { PROGRAM_COOKIE, isProgram } from "@/lib/programs";

/** The program (B.Tech / M.Tech) the user picked after signing in, or null if none yet. */
export async function getProgram(): Promise<Program | null> {
	const jar = await cookies();
	const value = jar.get(PROGRAM_COOKIE)?.value;
	return isProgram(value) ? value : null;
}
