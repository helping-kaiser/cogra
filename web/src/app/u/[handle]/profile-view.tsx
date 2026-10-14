"use client";

// The profile screen (design.md §6 "Profile header"): monogram
// avatar, name, handle, bio, link, the primary action — and the
// authored chronicle under filter chips. The header's connection
// count and the connections sections wait on the fold
// open-questions Q35 asks for.
// Shared by /u/<handle> (public) and /profile (the viewer's own tab).

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe, type MeUser } from "@/lib/api/auth-api";
import { appendDeduped } from "@/lib/api/pagination";
import { useSeenOnOpen } from "@/lib/history/seen-tracker";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { RestoreCard } from "@/app/applicant-status";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import {
  fetchAuthorRecords,
  fetchMyProfile,
  fetchProfileByHandle,
  type ChronicleFilter,
  type ProfileView as Profile,
  type RecordRow,
} from "@/lib/api/profile-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { StatusBanners } from "@/app/status-banners";
import { MonogramAvatar } from "@/lib/ui/actor-chip";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { StanceControl } from "@/lib/ui/stance-control";
import { TransportError } from "@/lib/ui/transport-error";
import { opensVouchBackOn, VOUCHED_IN_PATH, vouchBackVariant } from "@/lib/vouch/vouch-back";
import { useComfortLine } from "@/lib/saved/comfort-line";
import { useHostSnack } from "@/lib/saved/save-row";
import { RowLine } from "@/lib/ui/row-line";
import { Snackbar } from "@/lib/ui/snackbar";
import { backFor } from "@/lib/ui/back-origin";
import { BellButton } from "@/lib/ui/cogra-band";
import { notificationsHref } from "@/lib/notifications/origin";
import { firstArrival, useBellLit, useFreshRootBell } from "@/lib/notifications/bell";
import { ProfileMenu } from "@/lib/ui2/profile-menu";

const FILTERS: readonly { key: ChronicleFilter; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "comments", label: "Comments" },
  { key: "everything", label: "Everything" },
];

export function ProfileScreen({
  handle,
  store = identityStore,
  from = null,
}: {
  handle: string | null;
  /** Test injection. */
  store?: IdentityStore;
  /** The surface the reader came from, which the back arrow names (`saved`). */
  from?: string | null;
}) {
  // THE PAGE'S ONE SNACKBAR (`profile.snackbar`): the ⋮'s aftermath —
  // `Saved.`, `Removed from Saved.` with `Undo`, a copied link, a report.
  const { snack, notify, dismiss } = useHostSnack();
  const keyOnDevice = useKeyOnDevice(store);
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const host = useScrollHost();
  const router = useRouter();
  // THE BELL ON THE OWN PROFILE ROOT (Profile.md:3, :41): lit only on this
  // root's fresh load — its first arrival in the page load — and never by a
  // return (FeedUnread.md:3, :9).
  const account = useActiveAccountId();
  const reader = handle === null && phase === "signedIn" ? account : null;
  const [freshRoot] = useState(() => firstArrival(reader, "profile"));
  useFreshRootBell(reader, freshRoot);
  const bellIsLit = useBellLit(reader);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [own, setOwn] = useState(false);
  const [applicant, setApplicant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [transportFailed, setTransportFailed] = useState(false);
  const [filter, setFilter] = useState<ChronicleFilter>("posts");
  const [rows, setRows] = useState<readonly RecordRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [pageFailed, setPageFailed] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [invitesLocked, setInvitesLocked] = useState(false);
  // The viewer's own read, kept for the one profile it changes: the member
  // who vouched them in, whose anchor opens the vouch-back.
  const [viewer, setViewer] = useState<MeUser | null>(null);

  // OPENING SOMEONE'S PROFILE ADDS THE PROFILE TO HISTORY (History.md:11) —
  // the profile alone; its posts join only as the reader's lists see them.
  // The reader's own profile is not reported: it is where History's own door
  // stands (ProfileOwnMenu.md:3, :15), and a reader who has seen nothing must
  // still find History empty there.
  useSeenOnOpen(profile !== null && handle !== null && !own ? profile.id : null);

  // Which chronicle read is the live one. A filter switch fires a new read
  // without cancelling the old, and the old one resolving afterwards would
  // overwrite the cleared list with the PREVIOUS filter's rows — and set that
  // filter's cursor, so "Load more" would then walk the wrong connection.
  const rowsRequest = useRef(0);

  const loadRows = useCallback(
    async (authorId: string, which: ChronicleFilter, after: string | null) => {
      const request = (rowsRequest.current += 1);
      setRowsLoading(true);
      setPageFailed(false);
      const outcome = await fetchAuthorRecords(client, authorId, which, after);
      if (request !== rowsRequest.current) return;
      setRowsLoading(false);
      if (outcome.kind === "success") {
        // The chronicle is the surface most exposed to the repeat
        // `appendDeduped` exists for: it lists the author's own records, and a
        // record that lands between two fetches leaves the pending namespace
        // for a place below the cursor the walk resumes from.
        setRows((current) =>
          after === null ? outcome.value.items : appendDeduped(current, outcome.value.items),
        );
        setEndCursor(outcome.value.endCursor);
        setHasMore(outcome.value.hasNextPage);
      } else {
        setPageFailed(true);
      }
    },
    [client],
  );

  const refresh = useCallback(() => {
    let cancelled = false;
    void (async () => {
      const viewer =
        phase === "signedIn" ? await guard.run(() => fetchMe(client)) : null;
      const outcome =
        handle === null
          ? await guard.run(() => fetchMyProfile(client))
          : await fetchProfileByHandle(client, handle);
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind === "success") {
        const loaded = outcome.value;
        if (loaded === null) {
          setNotFound(true);
          return;
        }
        setNotFound(false);
        setTransportFailed(false);
        setProfile(loaded);
        const me = viewer?.kind === "success" ? viewer.value : null;
        setViewer(me);
        setOwn(me !== null && me.id === loaded.id);
        setApplicant(me?.accountState === "APPLICANT");
        void loadRows(loaded.id, "posts", null);
      } else if (outcome.kind === "refused") {
        // The own-profile read refused: the session is gone; the
        // phase flip handles it.
        setNotFound(true);
      } else {
        setTransportFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, guard, handle, phase, loadRows]);

  // Waiting for the phase keeps the own/other decision stable — a
  // resolving phase would misread the viewer as anonymous.
  useEffect(() => {
    if (phase === "resolving") return;
    const stop = refresh();
    return () => {
      // `refresh`'s own cancellation does not reach the `loadRows` it launches,
      // so the request counter is bumped here too: a read still in flight
      // belongs to a screen that is going away.
      rowsRequest.current += 1;
      stop();
    };
  }, [refresh, phase]);

  // Pull-down at the top is one of the surfaces the pull-to-refresh
  // ruling names (design/readme.md, "The pull-down lives on every
  // full-screen scrolling root", ruled 2026-09-10). It goes through
  // the same fetch the first arrival takes, so a fault it raises
  // surfaces in the same place.
  const onPull = useCallback(() => {
    setLoading(true);
    refresh();
  }, [refresh]);
  usePullToRefresh({ host, onPull });

  const onFilter = (next: ChronicleFilter) => {
    if (next === filter || profile === null) return;
    setFilter(next);
    setRows([]);
    setEndCursor(null);
    setHasMore(false);
    void loadRows(profile.id, next, null);
  };

  const name = profile?.displayName.value?.trim() ? profile.displayName.value : profile?.handle;
  // A DELETED ACCOUNT reads off its REDACTED status (ER-G10, design digest
  // item 19): the wire serves null values and the mark.
  const deleted = profile?.displayName.status === "REDACTED";
  const comfort = useComfortLine(profile?.id ?? "");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      <CollapsingTop>
        <PageHeader
          inGutter
          title={profile ? `@${profile.handle}` : "Profile"}
          backHref={handle === null ? undefined : backFor(from).href}
          backScroll={false}
          backLabel={backFor(from).label}
          backTestId="profile-back"
          action={
            own ? (
              <span className="flex items-center">
                <Link
                  href="/settings"
                  aria-label="Settings"
                  data-testid="profile-settings"
                  className={buttonClassName({ variant: "text", size: "sm" })}
                >
                  Settings
                </Link>
                {/* The bell rides the own profile ROOT only, right-most — the
                    header is not yet the drawn band (N3 conformance). */}
                {handle === null && (
                  <BellButton
                    bell={{ lit: bellIsLit, onOpen: () => router.push(notificationsHref("profile")) }}
                  />
                )}
              </span>
            ) : undefined
          }
        />
        {own && keyOnDevice === false && <RestoreCard />}
      </CollapsingTop>
      {own && <StatusBanners />}
      {loading && (
        <p role="status" aria-live="polite" data-testid="profile-loading">
          Loading…
        </p>
      )}
      {notFound && (
        <p data-testid="profile-not-found">This profile doesn&apos;t exist.</p>
      )}
      {transportFailed && profile === null && !loading && !notFound && (
        <div className="flex items-center gap-3">
          <TransportError testId="profile-transport-error" />
          <Button
            testId="profile-retry"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              refresh();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {profile && (
        <>
          <div className="flex flex-col gap-2 px-2">
            <span data-testid="profile-avatar">
              <MonogramAvatar name={name ?? "?"} size="lg" src={profile.avatar?.url} />
            </span>
            <h2 data-testid="profile-display-name" className="text-headline-small">
              {name}
            </h2>
            <p data-testid="profile-handle" className="text-body-medium text-on-surface-variant">
              @{profile.handle}
            </p>
            {profile.bio.value?.trim() && (
              <p data-testid="profile-bio" className="text-body-large">
                {profile.bio.value}
              </p>
            )}
            {profile.websiteUrl.value?.trim() && (
              <a
                href={profile.websiteUrl.value}
                rel="noreferrer nofollow"
                data-testid="profile-website"
                className="text-body-medium text-primary underline"
              >
                {profile.websiteUrl.value}
              </a>
            )}
            {/* The header's primary action on someone else's profile
                (design.md §6): the interpersonal stance, the same generic
                gesture a post or a comment takes. */}
            {!own && (
              <div className="flex items-center gap-2 pt-2">
                <StanceControl
                  target={{ id: profile.id, kind: "profile", label: `@${profile.handle}` }}
                  testIdPrefix="profile-stance"
                  // THE VOUCH-BACK STAYS OPEN FROM HERE (VouchBack.md:51): on
                  // the member who vouched the reader in, the anchor's tap
                  // opens the vouch-back pad (ProfileOther.md:35) and any
                  // signing taken on it — Set or the hold — opens the ceremony
                  // (:37). Cancel closes back onto this profile (VouchBackPad.md:47).
                  variant={
                    viewer !== null && opensVouchBackOn(viewer, profile.id)
                      ? vouchBackVariant(() => router.push(VOUCHED_IN_PATH))
                      : undefined
                  }
                />
                {/* THE ⋮ CLOSES THE ACTIONS ROW (`otherProfileMenu`,
                    `deletedProfileMenu`) — placed at its drawn node without
                    conforming the rest of the page (SS-6). */}
                <ProfileMenu
                  kind={deleted ? "deleted" : "other"}
                  profile={profile}
                  signedIn={phase === "signedIn"}
                  notify={notify}
                />
              </div>
            )}
            {/* THE ROW LINE IN THE ACTIONS ROW (design digest item 46): a save or
                unsave of this person that did not go through. */}
            {comfort !== null && <RowLine state={comfort} testId="profile-row-line" />}
            {own && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Link
                  href="/profile/edit"
                  data-testid="profile-edit"
                  className={buttonClassName({ variant: "outline", size: "sm" })}
                >
                  Edit profile
                </Link>
                {/* Visible but locked for applicants — the tap explains
                    (auth.md "Application"). */}
                {applicant ? (
                  <Button
                    testId="profile-invites"
                    variant="outline"
                    size="sm"
                    onClick={() => setInvitesLocked(true)}
                  >
                    Invites
                  </Button>
                ) : (
                  <Link
                    href="/invites"
                    data-testid="profile-invites"
                    className={buttonClassName({ variant: "outline", size: "sm" })}
                  >
                    Invites
                  </Link>
                )}
                {/* YOUR OWN ⋮, closing the actions row after Edit profile and
                    Invites (`ownProfileMenu`): Saved, History, Share your
                    profile — the private state's one door. */}
                <ProfileMenu kind="own" profile={profile} signedIn notify={notify} />
              </div>
            )}
            {invitesLocked && (
              <p role="status" data-testid="profile-invites-locked" className="text-body-small text-on-surface-variant">
                Inviting unlocks once your application is approved.
              </p>
            )}
          </div>
          <div role="group" aria-label="Chronicle filter" className="flex gap-2">
            {FILTERS.map(({ key, label }) => (
              <Button
                key={key}
                testId={`profile-filter-${key}`}
                variant={filter === key ? "primary" : "outline"}
                size="sm"
                onClick={() => onFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          {rows.length === 0 && !rowsLoading && !pageFailed && (
            <p data-testid="profile-chronicle-empty" className="text-body-medium text-on-surface-variant">
              Nothing here yet.
            </p>
          )}
          <ul className="flex flex-col gap-3" data-testid="profile-chronicle">
            {rows.map((row) => (
              <li key={row.id} data-testid="chronicle-row">
                {row.postId ? (
                  <Link href={`/posts/${row.postId}`}>
                    <ChronicleCard row={row} />
                  </Link>
                ) : (
                  <ChronicleCard row={row} />
                )}
              </li>
            ))}
          </ul>
          {rowsLoading && <p data-testid="profile-rows-loading">Loading…</p>}
          {pageFailed && (
            <Button
              testId="profile-rows-retry"
              variant="outline"
              size="sm"
              onClick={() => profile && void loadRows(profile.id, filter, endCursor)}
            >
              Retry
            </Button>
          )}
          {hasMore && !rowsLoading && !pageFailed && (
            <Button
              testId="profile-rows-more"
              variant="outline"
              onClick={() => profile && void loadRows(profile.id, filter, endCursor)}
            >
              Show more
            </Button>
          )}
        </>
      )}
      <Snackbar
        testId="profile-snackbar"
        node={{ path: "profile.snackbar" }}
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismiss}
      />
    </main>
  );
}

function ChronicleCard({ row }: { row: RecordRow }) {
  return (
    <Card>
      <p className="text-label-large">{row.label}</p>
      {row.snippet?.trim() && (
        <p className="line-clamp-2 text-body-medium text-on-surface-variant">{row.snippet}</p>
      )}
    </Card>
  );
}
