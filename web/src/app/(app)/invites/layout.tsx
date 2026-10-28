import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page is a client component (it reads `?from=`), so its title rides here.
export const metadata: Metadata = { title: "Invites — CoGra" };

export default function InvitesLayout({ children }: { children: ReactNode }) {
  return children;
}
