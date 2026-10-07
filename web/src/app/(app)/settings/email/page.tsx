import type { Metadata } from "next";

import { ChangeEmailView } from "./change-email-view";

export const metadata: Metadata = { title: "Change your email — CoGra" };

export default function ChangeEmailPage() {
  return <ChangeEmailView />;
}
