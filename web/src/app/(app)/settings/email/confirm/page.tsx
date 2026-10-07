import type { Metadata } from "next";

import { ChangeEmailConfirmView } from "./change-email-confirm-view";

export const metadata: Metadata = { title: "Confirm the change — CoGra" };

export default function ChangeEmailConfirmPage() {
  return <ChangeEmailConfirmView />;
}
