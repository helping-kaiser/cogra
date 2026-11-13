"use client";

// THE COMPOSER'S OWN ADDRESS IS A DOOR TOO (ApplicantFeed.md:49, ProfileApplicant.md:26:
// "NEVER the wizard opens"). An applicant who opens `/compose` by address lands
// where app-open lands for them, under `You can post once you're in.` — the ask
// link's own answer to a reader it cannot serve (VouchAsk.md:15,
// `vouch-ask-view.tsx`). Until the session's account read has answered, nothing
// is drawn, so the wizard never shows for a moment before the answer
// (`reader-state.ts`).

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { POST_LOCKED, useReaderState } from "@/lib/session/reader-state";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { PostEditRoute } from "./post-edit-route";
import { ComposeWizard } from "./wizard/wizard-view";

export function ComposeRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const reader = useReaderState();
  const applicant = reader.accountState === "APPLICANT";

  useEffect(() => {
    if (!applicant) return;
    carrySnackbar(POST_LOCKED);
    router.replace("/");
  }, [applicant, router]);

  if (!reader.settled || applicant) return null;
  // `?reference=` prefills a citation on a NEW post, so it stays with the
  // wizard; only `?post=` names an existing post to edit.
  const post = params.get("post");
  return post === null ? <ComposeWizard /> : <PostEditRoute postId={post} />;
}
