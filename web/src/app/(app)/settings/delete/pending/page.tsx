import type { Metadata } from "next";

import { DeleteAccountPendingView } from "./delete-account-pending-view";

export const metadata: Metadata = { title: "Delete account — CoGra" };

export default function DeleteAccountPendingPage() {
  return <DeleteAccountPendingView />;
}
