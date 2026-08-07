import type { Metadata } from "next";

import { InvitesView } from "./invites-view";

export const metadata: Metadata = { title: "Invites — CoGra" };

export default function InvitesPage() {
  return <InvitesView />;
}
