// The new address's link (auth.md "Link URLs": /email-change?token= on the
// web origin). Public: the link may open in a browser with no session, where
// the landing applies nothing and asks for a sign-in first.

import { Suspense } from "react";
import type { Metadata } from "next";

import { EmailChangeView } from "./email-change-view";

export const metadata: Metadata = { title: "Your new address — CoGra" };

export default function EmailChangePage() {
  return (
    <Suspense>
      <EmailChangeView />
    </Suspense>
  );
}
