"use client";

// WHEN THE INTRO OPENS (OnboardingSteps.md:3–7).
//
// BY ITSELF, ONCE PER ACCOUNT: the first authenticated feed a reader enters,
// from applicant on, while the account's seen flag is unset — and never once
// the flag is set, on any device. The flag is the server's
// (`UserPreferences.hasSeenOnboarding`), so no device memory is kept here.
//
// THE FLAG SETS THE MOMENT IT SHOWS (:29), never on Skip or `Start reading`:
// an intro interrupted by a closed tab or a dropped connection does not come
// back by itself. Settings' `Watch the intro again` is the way back in (:7).
//
// WHERE IT LEAVES TO is where it opened (each card's Skip and `Start reading`
// lines): the feed it covered, or Settings when Settings re-opened it — the
// intro is a layer over that page, so leaving is lowering the layer.

import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchIntroAccount, introInviterOf, markIntroSeen } from "@/lib/api/intro-api";
import { useAuthGuard } from "@/lib/session/runtime";

import { Intro } from "./intro";
import type { IntroInviter } from "./intro-stages";

/** The intro over the feed, shown by itself the first time an account enters it. */
export function FirstIntro() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [open, setOpen] = useState(false);
  const [inviter, setInviter] = useState<IntroInviter | null>(null);

  useEffect(() => {
    let cancelled = false;
    void guard.run(() => fetchIntroAccount(client)).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      if (outcome.value.preferences?.hasSeenOnboarding === true) return;
      setInviter(introInviterOf(outcome.value));
      setOpen(true);
      void guard.run(() => markIntroSeen(client));
    });
    return () => {
      cancelled = true;
    };
  }, [client, guard]);

  if (!open) return null;
  return <Intro inviter={inviter} onLeave={() => setOpen(false)} />;
}

/** The intro re-opened from Settings, at its first card; it leaves back onto Settings. */
export function ReplayIntro({ onLeave }: { onLeave: () => void }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [inviter, setInviter] = useState<IntroInviter | null>(null);

  useEffect(() => {
    let cancelled = false;
    void guard.run(() => fetchIntroAccount(client)).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      setInviter(introInviterOf(outcome.value));
    });
    return () => {
      cancelled = true;
    };
  }, [client, guard]);

  return <Intro inviter={inviter} onLeave={onLeave} />;
}
