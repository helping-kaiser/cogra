import type { Metadata } from "next";

import { InviteEntry } from "./invite-entry";

export const metadata: Metadata = { title: "Join — CoGra" };

export default function JoinPage() {
  return <InviteEntry />;
}
