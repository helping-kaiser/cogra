"use client";

// `/key` OPENED BY A MEMBER WHO HAS A KEY (jakob 2026-11-23, seam 405/411):
// they land on what settings' `Your key` row opens — `YourKey`, `YourKeyGate`
// or `YourKeyAbsent` by custody — never the create ceremony. Typed, reloaded,
// deep-linked or reached by Back/Forward, the address answers the same.
//
// THE SAME READ, THE SAME PREDICATE: the row decides on the settings account
// read and `keyMade`; so does this door, so the two can never disagree.
// Every other reader (an applicant, before or after their key; a read that
// did not answer) meets the route as before — the children, which are the
// custody gate and the ceremony behind it.
//
// NOTHING IS DRAWN UNTIL THE READ ANSWERS, so the ceremony never shows for a
// frame first. The landing is Next's `redirect` called while rendering — the
// documented way for a Client Component to send the reader elsewhere during
// render, and a REPLACE outside Server Actions, so `/key` leaves the history
// and Back never bounces into it (node_modules/next/dist/docs/01-app/
// 03-api-reference/04-functions/redirect.md, "Parameters" and "Client
// Component"; 02-guides/redirecting.md).

import { useApolloClient } from "@apollo/client/react";
import { redirect } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { keyMade, YOUR_KEY_ROUTE } from "@/lib/identity/key-custody-routes";
import { useAuthGuard } from "@/lib/session/runtime";

export function KeyedMemberDoor({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  /** null while the read runs; then whether this reader is a member with a key. */
  const [keyedMember, setKeyedMember] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void guard.run(() => fetchSettingsAccount(client)).then(
      (outcome) => {
        if (!live) return;
        setKeyedMember(
          outcome.kind === "success" && outcome.value.accountState === "MEMBER" && keyMade(outcome.value),
        );
      },
      () => {
        if (live) setKeyedMember(false);
      },
    );
    return () => {
      live = false;
    };
  }, [client, guard]);

  if (keyedMember === null) return null;
  if (keyedMember) redirect(YOUR_KEY_ROUTE);
  return <>{children}</>;
}
