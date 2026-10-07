import type { Metadata } from "next";

import { ChangePasswordView } from "./change-password-view";

export const metadata: Metadata = { title: "Change your password — CoGra" };

export default function ChangePasswordPage() {
  return <ChangePasswordView />;
}
