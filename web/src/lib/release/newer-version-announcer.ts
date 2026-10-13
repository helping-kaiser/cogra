"use client";

// A NEWER VERSION, SAID ONCE (FeedNewerVersion.md; release-registry packet
// §4.4). On a cold open's feed, a release newer than the one running here
// that this device has not announced raises one quiet snackbar,
// `A newer version of CoGra is out.` with `Update now`, and the device
// marks that release announced the moment it shows — so a timeout or a
// dismissal costs nothing and the release never comes back.
//
// THE COLD OPEN IS A DOCUMENT LOAD. A full page load starts this module
// fresh; client-side navigation back to the feed does not, and a return to
// the foreground (`visibilitychange`) never touches it. So the one-shot is
// module state: one registry read per document, one decision per document.
//
// THE DECISION WAITS FOR THE FEED. A read that lands after the feed has
// arrived announces as it arrives (design ruling 63); one that lands while
// the reader is elsewhere is decided at the feed's next arrival in the same
// load, because the law is a feed snackbar — the gate stays open until a
// feed on screen has heard the answer.
//
// A FAILED READ IS SILENT and leaves the flag alone, so the next cold open
// asks again: the law's GIVEN — a newer release exists — was never
// established, and the snackbar is never a confirmation of anything.
//
// It announces to members, applicants and guests alike (design ruling 62):
// the registry read is anonymous, and every reader's feed is this one view.

import { useApolloClient } from "@apollo/client/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchReleases } from "@/lib/api/releases-api";
import type { Outcome } from "@/lib/api/outcome";
import { RUNNING_VERSION } from "./running-version";
import { versionStatus, type Release } from "./version-status";

export const NEWER_VERSION_SNACKBAR = "A newer version of CoGra is out.";
export const UPDATE_NOW = "Update now";

const FLAG_KEY = "cogra.announcedRelease";

/** The device's record of the last release it announced. Blocked storage reads as never announced and writes nothing — it never throws. */
export type AnnouncedFlag = {
  read: () => string | null;
  write: (version: string) => void;
};

export const localAnnouncedFlag: AnnouncedFlag = {
  read: () => {
    try {
      return window.localStorage.getItem(FLAG_KEY);
    } catch {
      return null;
    }
  },
  write: (version) => {
    try {
      window.localStorage.setItem(FLAG_KEY, version);
    } catch {
      // A browser that refuses storage simply announces again next time.
    }
  },
};

/** The release to announce, or none: behind, and not the one this device already announced. */
export function releaseToAnnounce(
  releases: readonly Release[],
  running: string,
  lastAnnounced: string | null,
): Release | null {
  const { newest } = versionStatus(releases, running);
  if (newest === null || newest.version === lastAnnounced) return null;
  return newest;
}

let read: Promise<Outcome<readonly Release[]>> | null = null;
let decided = false;

/** The document's one registry read, shared by every feed arrival in this load. */
function registryRead(load: () => Promise<Outcome<readonly Release[]>>) {
  if (read === null) read = load();
  return read;
}

/** Starts the module over, as a fresh page load would. Tests only. */
export function resetAnnouncerForTests(): void {
  read = null;
  decided = false;
}

export type AnnouncerDeps = {
  load: () => Promise<Outcome<readonly Release[]>>;
  running: string;
  flag: AnnouncedFlag;
  /** `Update now` on the web: the page reloads into the new version (WhatsNewBehind.md:17). */
  reload: () => void;
};

export type Announcement = {
  /** `null` while there is nothing to say. */
  message: string | null;
  action: { label: string; onAction: () => void } | undefined;
  dismiss: () => void;
};

/**
 * The feed's newer-version snackbar. `arrived` is the feed on screen with its
 * content in; `free` is the feed's own snackbar standing empty — Material
 * shows one snackbar at a time, so whichever came first finishes first.
 */
export function useNewerVersionAnnouncement(
  arrived: boolean,
  free: boolean,
  injected?: Partial<AnnouncerDeps>,
): Announcement {
  const client = useApolloClient();
  const deps = useMemo<AnnouncerDeps>(
    () => ({
      load: injected?.load ?? (() => fetchReleases(client, injected?.running ?? RUNNING_VERSION)),
      running: injected?.running ?? RUNNING_VERSION,
      flag: injected?.flag ?? localAnnouncedFlag,
      reload: injected?.reload ?? (() => window.location.reload()),
    }),
    [client, injected?.load, injected?.running, injected?.flag, injected?.reload],
  );
  const [pending, setPending] = useState<Release | null>(null);
  const [showing, setShowing] = useState<Release | null>(null);

  useEffect(() => {
    if (!arrived || decided) return;
    let onScreen = true;
    void registryRead(deps.load).then((outcome) => {
      if (!onScreen || decided) return;
      decided = true;
      if (outcome.kind !== "success") return;
      setPending(releaseToAnnounce(outcome.value, deps.running, deps.flag.read()));
    });
    return () => {
      onScreen = false;
    };
  }, [arrived, deps]);

  // The queue's one step, taken while rendering (React docs, "Storing
  // information from previous renders"): a waiting announcement rises the
  // moment the feed's own snackbar stands empty, and holds once risen.
  if (pending !== null && free && showing === null) {
    setShowing(pending);
    setPending(null);
  }

  // The release is marked announced as the snackbar shows (FeedNewerVersion.md:3).
  useEffect(() => {
    if (showing !== null) deps.flag.write(showing.version);
  }, [showing, deps]);

  const dismiss = useCallback(() => setShowing(null), []);
  return {
    message: showing === null ? null : NEWER_VERSION_SNACKBAR,
    action: showing === null ? undefined : { label: UPDATE_NOW, onAction: deps.reload },
    dismiss,
  };
}
