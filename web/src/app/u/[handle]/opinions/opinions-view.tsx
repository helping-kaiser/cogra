"use client";

// THE OPINIONS PAGE (design/designs/canonical/screens/ProfileStances.jsx;
// behavior/ProfileStances.md; graph.json `ProfileStances`). Opened from any
// profile's figures row: titled with the person's handle and `Opinions`, the
// two directions on two tabs named in words — `On them` · `By them`, `On you` ·
// `By you` on the reader's own — and
// never one merged list. Each row is a person with the public opinion the row
// is about (`StanceRow`), read-only, strongest first; tapping one opens their
// profile, whose arrow reads `Back to the opinions`. A read drill-in: the back
// arrow names the profile it came from, and the bar rides, lit for the root
// that profile was opened from.
//
// THE FIGURE COUNTS RECORDS; THE PAGE LISTS PEOPLE (open-questions.md Q35).
// `Opinions on them` counts every Opinion record aimed at the person — a
// revision is a record of its own — while `On them` draws one row per person,
// at the opinion they hold now (`held-opinions.ts`). The two can differ, and
// each says what its words say.
//
// THE WHOLE SET IS READ, 100 RECORDS A PAGE, BEFORE A ROW IS DRAWN: the order
// is strongest first, and a bundle's place is not known until its last record
// is. The list then stands whole, with nothing left to page in.
//
// REGISTERED AS `profileStances` (nodes.json, round 26): the rows stand in
// `list`, each `list.row` keyed by the handle of the person it names — the
// opinion's holder on On, the one it is held on on By — never by position.

import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe } from "@/lib/api/auth-api";
import { fetchProfileOpinions, type HeldOpinionView } from "@/lib/api/opinions-api";
import { fetchMyProfile, fetchProfileByHandle, type ProfileView as Profile } from "@/lib/api/profile-api";
import {
  opinionsHref,
  opinionsOrigin,
  type OpinionDirection,
} from "@/lib/profile/opinions-route";
import { useAuthGuard } from "@/lib/session/runtime";
import { useAuthPhase } from "@/lib/session/provider";
import { Button } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { EmptyState } from "@/lib/ui/empty-state";
import { PageHeader } from "@/lib/ui/page-header";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { TransportError } from "@/lib/ui/transport-error";
import { NO_OPINIONS } from "@/lib/ui2/opinions-sheet";
import { StanceRow } from "@/lib/ui2/stance-row";
import { TabBar, type Tab } from "@/lib/ui2/tab-bar";

const PAGE: DataNode = { path: "profileStances" };
const LIST = part(PAGE, "list");

/**
 * A row's key (nodes.json `profileStances.list.row`): the handle of the
 * person the row names, without @. A deleted account's row has no handle left
 * to name it, so its holder's address stands in — opaque, one per person.
 */
export function rowKey(opinion: HeldOpinionView): string {
  return opinion.holder.handle ?? opinion.holderId;
}

/**
 * The tab row (ProfileStances.jsx): the choice is named `Which direction`.
 * Another's page and a deleted account's read `On them` · `By them`; the
 * reader's own speaks in the own figures' second person, `On you` · `By
 * you` (ProfileStances.md:7-9; copy-voice, *The opinions page*).
 */
export function directionTabs(own: boolean): readonly Tab<OpinionDirection>[] {
  return own ? OWN_TABS : THEIR_TABS;
}
const THEIR_TABS: readonly Tab<OpinionDirection>[] = [
  { id: "on", label: "On them" },
  { id: "by", label: "By them" },
];
const OWN_TABS: readonly Tab<OpinionDirection>[] = [
  { id: "on", label: "On you" },
  { id: "by", label: "By you" },
];
export const DIRECTION_TABS_LABEL = "Which direction";

/**
 * The empty list's line, per tab and whose page it is: the figure's own noun
 * at zero, in the empty sheet's calm register, never the error colour
 * (ProfileStances.md:31-41; copy-voice, *The opinions page*). Another's
 * `On them` keeps the opinions sheet's `No opinions yet — yours would be the
 * first.`; a deleted account, which will give none again, says so in the past.
 */
export function emptyLine(direction: OpinionDirection, whose: "own" | "other" | "deleted", handle: string): string {
  if (direction === "on") {
    if (whose === "other") return NO_OPINIONS;
    return whose === "own" ? "No opinions on you yet." : "No opinions on this account yet.";
  }
  if (whose === "own") return "No opinions by you yet.";
  return whose === "other" ? `No opinions by @${handle} yet.` : "This account gave no opinions.";
}

type Rows = { readonly direction: OpinionDirection; readonly rows: readonly HeldOpinionView[] };

export function OpinionsScreen({
  handle,
  from = null,
  tab = "on",
}: {
  /** The person whose page this is; null on the reader's own root (`/profile/opinions`). */
  handle: string | null;
  /** The `from` the profile itself was opened with, carried so its way back holds. */
  from?: string | null;
  /** The direction the page opens on. */
  tab?: OpinionDirection;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const host = useScrollHost();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [own, setOwn] = useState(handle === null);
  const [notFound, setNotFound] = useState(false);
  const [direction, setDirection] = useState<OpinionDirection>(tab);
  const [listed, setListed] = useState<Rows | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Which read is the live one: a tab switched mid-read must not have the
  // previous tab's rows land on it.
  const request = useRef(0);

  const readRows = useCallback(
    async (userId: string, which: OpinionDirection) => {
      const asked = (request.current += 1);
      setLoading(true);
      setFailed(false);
      const outcome = await fetchProfileOpinions(client, userId, which);
      if (asked !== request.current) return;
      setLoading(false);
      if (outcome.kind === "success") setListed({ direction: which, rows: outcome.value });
      else setFailed(true);
    },
    [client],
  );

  // The direction rides in a ref too, written where it changes (the tab tap),
  // so a refresh reads the tab standing now without re-running the profile
  // read on every switch.
  const directionNow = useRef<OpinionDirection>(tab);

  const refresh = useCallback(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setFailed(false);
      const viewer = phase === "signedIn" ? await guard.run(() => fetchMe(client)) : null;
      const outcome =
        handle === null ? await guard.run(() => fetchMyProfile(client)) : await fetchProfileByHandle(client, handle);
      if (cancelled) return;
      if (outcome.kind !== "success") {
        setLoading(false);
        setFailed(true);
        return;
      }
      if (outcome.value === null) {
        setLoading(false);
        setNotFound(true);
        return;
      }
      const loaded = outcome.value;
      setNotFound(false);
      setProfile(loaded);
      const me = viewer?.kind === "success" ? viewer.value : null;
      setOwn(handle === null || (me !== null && me.id === loaded.id));
      void readRows(loaded.id, directionNow.current);
    })();
    return () => {
      cancelled = true;
      request.current += 1;
    };
  }, [client, guard, handle, phase, readRows]);

  useEffect(() => {
    if (phase === "resolving") return;
    return refresh();
  }, [refresh, phase]);

  // THE PULL-DOWN AT THE TOP REFRESHES (ProfileStances.md:29; readme, the
  // pull-down on every full-screen scrolling root), through the first read.
  usePullToRefresh({ host, onPull: refresh });

  // A TAB TAP SWAPS THE LIST IN PLACE (ProfileStances.md:13-15) and writes the
  // direction into the address without a new history entry, so a way back to
  // the page lands on the tab it was left on (Next: the native History API
  // integrates with the router — linking-and-navigating.md).
  const onDirection = (next: OpinionDirection) => {
    if (next === direction) return;
    directionNow.current = next;
    setDirection(next);
    setListed(null);
    window.history.replaceState(null, "", opinionsHref(handle, next, from));
    if (profile !== null) void readRows(profile.id, next);
  };

  const deleted = profile?.displayName.status === "REDACTED";
  const whose = own ? "own" : deleted ? "deleted" : "other";
  // THE WAY BACK NAMES WHOSE PROFILE (ProfileStances.md:23-25): `Back to your
  // profile` from the reader's own, `Back to the profile` from another's —
  // returning it as it was opened, its own `from` and all.
  const back =
    handle === null
      ? { href: "/profile", label: "Back to your profile" }
      : {
          href: from === null ? `/u/${encodeURIComponent(handle)}` : `/u/${encodeURIComponent(handle)}?from=${encodeURIComponent(from)}`,
          label: own ? "Back to your profile" : "Back to the profile",
        };
  const rows = listed !== null && listed.direction === direction ? listed.rows : null;
  // A deleted account's handle went with the rest (ProfileDeleted.md:11), so
  // its page is titled with what it holds alone.
  const title =
    profile === null ? undefined : deleted ? "Opinions" : `@${profile.handle} · Opinions`;
  const rowOrigin = opinionsOrigin(handle, direction);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col pb-2">
      <CollapsingTop flush>
        {/* THE TAB ROW STANDS DIRECTLY UNDER THE BAR (ProfileStances.jsx): one
            block, so the collapsing region's own gap never opens between them. */}
        <div>
          <PageHeader
            node={part(PAGE, "header")}
            title={title}
            backHref={back.href}
            backScroll={false}
            backLabel={back.label}
            backTestId="opinions-back"
          />
          <TabBar
            tabs={directionTabs(own)}
            value={direction}
            ariaLabel={DIRECTION_TABS_LABEL}
            onSelect={onDirection}
            node={part(PAGE, "tabRow")}
            testId="opinions-tabs"
          />
        </div>
      </CollapsingTop>
      {notFound && (
        <p data-testid="opinions-not-found" className="px-4 py-2">
          This profile doesn&apos;t exist.
        </p>
      )}
      {loading && rows === null && !notFound && (
        <p role="status" aria-live="polite" data-testid="opinions-loading" className="px-4 py-2">
          Loading…
        </p>
      )}
      {failed && !loading && rows === null && (
        <div className="flex items-center gap-3 px-4 py-2">
          <TransportError testId="opinions-transport-error" />
          <Button testId="opinions-retry" variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}
      {rows !== null && rows.length === 0 && profile !== null && (
        <div className="px-6 pt-2">
          <EmptyState
            title={emptyLine(direction, whose, profile.handle)}
            testId="opinions-empty"
            node={part(PAGE, "empty")}
          />
        </div>
      )}
      {rows !== null && rows.length > 0 && (
        <div className="flex flex-col pt-1" {...testAttributes(LIST)}>
          {rows.map((opinion, index) => (
            <StanceRow
              key={opinion.holderId}
              name={opinion.holder.name}
              handle={opinion.holder.handle}
              src={opinion.holder.avatarUrl}
              redacted={opinion.holder.redacted}
              pair={opinion.pair}
              severed={opinion.severed}
              from={rowOrigin}
              node={instance(LIST, "row", rowKey(opinion))}
              testId={`opinions-row-${index + 1}`}
            />
          ))}
        </div>
      )}
    </main>
  );
}
