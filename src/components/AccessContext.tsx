"use client";
import { createContext, useContext } from "react";
import type { Access } from "@/lib/roles";

const AccessContext = createContext<Access | null>(null);

export function AccessProvider({
	access,
	children,
}: {
	access: Access;
	children: React.ReactNode;
}) {
	return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

/** The signed-in user's roles for the active program (client pages inside the dashboard). */
export function useAccess(): Access {
	const access = useContext(AccessContext);
	if (!access) throw new Error("useAccess must be used inside the dashboard");
	return access;
}
