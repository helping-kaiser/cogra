import type { Metadata } from "next";

import { DeleteAccountView } from "./delete-account-view";

export const metadata: Metadata = { title: "Delete account — CoGra" };

export default function DeleteAccountPage() {
  return <DeleteAccountView />;
}
