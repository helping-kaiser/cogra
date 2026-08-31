"use client";

// ComposeLanded — what the author sees the moment a post lands.
//
// The board is the POST'S OWN PAGE carrying a snackbar, not the feed carrying a
// card: an author who has just published wants to see the thing they published,
// and the settling the message speaks of is visible right there on it.
//
// A snackbar rather than a card because it is a confirmation of a completed
// action (design.md §6) — it says the act went through and then gets out of the
// way. Dismissing drops the query value, so a reload cannot fire it again.

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Snackbar } from "@/lib/ui/snackbar";

/** The one query value this reads; anything else is an ordinary visit. */
export function justPublished(value: string | null): boolean {
  return value === "1";
}

export function PublishedNotice({ postId }: { postId: string }) {
  const router = useRouter();
  const published = justPublished(useSearchParams().get("published"));
  const dismiss = useCallback(() => {
    router.replace(`/posts/${postId}`);
  }, [router, postId]);

  return (
    <Snackbar
      testId="post-published"
      message={published ? "Signed — it's in the thread now, still settling." : null}
      onDismiss={dismiss}
    />
  );
}
