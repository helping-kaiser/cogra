import { Suspense } from "react";
import type { Metadata } from "next";

import { DeleteAccountMailView } from "./delete-account-mail-view";

export const metadata: Metadata = { title: "Check your mail — CoGra" };

export default function DeleteAccountMailPage() {
  return (
    <Suspense>
      <DeleteAccountMailView />
    </Suspense>
  );
}
