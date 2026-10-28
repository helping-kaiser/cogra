"use client";

// Invites, from whichever door opened it: `?from=` names the door for the
// back arrow (Invites.md:95-97). `useSearchParams` needs a Suspense boundary
// on a page that is otherwise statically rendered (Next `use-search-params`).

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { InvitesView } from "./invites-view";

function FromDoor() {
  return <InvitesView from={useSearchParams().get("from")} />;
}

export default function InvitesPage() {
  return (
    <Suspense fallback={null}>
      <FromDoor />
    </Suspense>
  );
}
