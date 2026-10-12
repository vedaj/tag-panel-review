"use client";
import { createContext, useContext } from "react";
import type { Program } from "@/types/database";

const ProgramContext = createContext<Program>("btech");

export function ProgramProvider({
	program,
	children,
}: {
	program: Program;
	children: React.ReactNode;
}) {
	return <ProgramContext.Provider value={program}>{children}</ProgramContext.Provider>;
}

/** The active program (B.Tech / M.Tech) for client pages inside the dashboard. */
export function useProgram(): Program {
	return useContext(ProgramContext);
}
