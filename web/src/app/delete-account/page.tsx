// The deletion mail's link (auth.md "Link URLs": /delete-account?token= on the
// web origin). Public: the link confirms with no session — it is the proof.

import { Suspense } from "react";
import type { Metadata } from "next";

import { DeleteAccountConfirmedView } from "./delete-account-confirmed-view";

export const metadata: Metadata = { title: "Account deletion — CoGra" };

export default function DeleteAccountPage() {
  return (
    <Suspense>
      <DeleteAccountConfirmedView />
    </Suspense>
  );
}
