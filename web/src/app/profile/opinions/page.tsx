"use client";

// The reader's own opinions page (`ProfileStances`), under the profile tab's
// root. Client-gated like the own profile: a signed-out arrival lands on
// /login. A Client Component page reads its search params through `use`
// (Next `page.md`, "Reading searchParams and params in Client Components").

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { OpinionsScreen } from "@/app/u/[handle]/opinions/opinions-view";
import { directionOf } from "@/lib/profile/opinions-route";
import { useAuthPhase } from "@/lib/session/provider";

export default function OwnOpinionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = use(searchParams);
  const phase = useAuthPhase();
  const router = useRouter();
  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);
  if (phase !== "signedIn") return null;
  return <OpinionsScreen handle={null} tab={directionOf(typeof tab === "string" ? tab : null)} />;
}
