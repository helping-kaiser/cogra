"use client";

// THE PROFILE (design/designs/canonical/screens/Profile.jsx, ProfileOther.jsx,
// ProfileDeleted.jsx, ProfileApplicant.jsx; `_shared.jsx` `ProfileOwnBody`,
// `ProfileOtherBody`, `ProfileDeletedBody`). One surface, the `profile`
// registry prefix, shared by /profile (the reader's own tab ROOT) and
// /u/<handle> (a drill-in):
//
// - The own root wears the band (`ProfileBand`): the mark, then the gear,
//   chats and the bell. A drill-in wears the header bar, titled with the
//   person's handle and carrying the way back alone — a deleted account's
//   titled with nothing, the handle having gone with it.
// - Under it the compact `ProfileHeader` and its one actions row: Edit
//   profile, Invites and the ⋮ on your own page; the wide opinion, Message and
//   the ⋮ on someone else's; the opinion and the ⋮ on a deleted account's.
// - Then the chronicle's tab row and the chronicle, one act to a card,
//   newest first, the next page arriving as the reader keeps going.
//
// THE COLUMN SPENDS NO GAP. A flex gap is spent on every child, CollapsingTop's
// zero-height sentinel and the empty slots included, which put 16px of
// nothing under the header; each slot carries its own spacing instead.

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
import { EMPTY_PICK_LABEL } from "@/lib/stance/anchors";
import { useAuthGuard } from "@/lib/session/runtime";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { StatusBanners } from "@/app/status-banners";
import { Button, buttonClassName } from "@/lib/ui/button";
import { CograBand } from "@/lib/ui/cogra-band";
import { instance, type DataNode } from "@/lib/ui/data-node";
import { EmptyState } from "@/lib/ui/empty-state";
import { Icon } from "@/lib/ui/icons";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { PageHeader } from "@/lib/ui/page-header";
import { ProfileHeader } from "@/lib/ui/profile-header";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { StanceControl } from "@/lib/ui/stance-control";
import { ladderAge } from "@/lib/ui/timestamp";
import { TransportError } from "@/lib/ui/transport-error";
import { ContentRow, type ContentRowDisc } from "@/lib/ui2/content-row";
import { TabBar, type Tab } from "@/lib/ui2/tab-bar";
import { opensVouchBackOn, VOUCHED_IN_PATH, vouchBackVariant } from "@/lib/vouch/vouch-back";
import { useComfortLine } from "@/lib/saved/comfort-line";
import { useHostSnack } from "@/lib/saved/save-row";
import { RowLine } from "@/lib/ui/row-line";
import { Snackbar } from "@/lib/ui/snackbar";
import { backFor, personOrigin } from "@/lib/ui/back-origin";
import { notificationsHref } from "@/lib/notifications/origin";
import { firstArrival, useBellLit, useFreshRootBell } from "@/lib/notifications/bell";
import { ProfileMenu } from "@/lib/ui2/profile-menu";

/** The chronicle's tab row (`_shared.jsx` `CHRONICLE_TABS`, `CHRONICLE_TABS_LABEL`). */
const CHRONICLE_TABS: readonly Tab<ChronicleFilter>[] = [
  { id: "posts", icon: "dynamic_feed", label: "Posts" },
  { id: "comments", icon: "chat_bubble", label: "Comments" },
  { id: "everything", icon: "history", label: "Everything" },
];
export const CHRONICLE_TABS_LABEL = "What the chronicle shows";

/** ProfileApplicant.md:17. */
export const INVITE_LOCKED = "You can invite once you're in.";
/** ProfileApplicant.md:21 — the applicant-foot family's `once you're in`. */
export const APPLICANT_CHRONICLE_EMPTY =
  "Nothing here yet. Your posts and opinions show up here once you're in.";
/** The chronicle page that did not arrive (Profile.md:35; copy-voice.md). */
export const COULDNT_LOAD_MORE = "Couldn't load more";
/** How long a next page may take before `Loading…` stands for it (Profile.md:33). */
export const LOADING_AFTER_MS = 200;

const CHRONICLE: DataNode = { path: "profile.chronicle" };
const IDENTITY: DataNode = { path: "profile.identity" };
const ROW = (name: string): DataNode => ({ path: `profile.identity.actionRow.${name}` });

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
  // `Saved.`, `Removed from Saved.` with `Undo`, a copied link, a report —
  // and the applicant's locked Invites.
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
  // Every profile board draws the reader landing on Everything.
  const [filter, setFilter] = useState<ChronicleFilter>("everything");
  const [rows, setRows] = useState<readonly RecordRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [pageFailed, setPageFailed] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  // The viewer's own read, kept for the one profile it changes: the member
  // who vouched them in, whose anchor opens the vouch-back.
  const [viewer, setViewer] = useState<MeUser | null>(null);

  // OPENING SOMEONE'S PROFILE ADDS THE PROFILE TO HISTORY (History.md:11) —
  // the profile alone; its posts join only as the reader's lists see them.
  // The reader's own profile is not reported: it is where History's own door
  // stands (ProfileOwnMenu.md:3, :15), and a reader who has seen nothing must
  // still find History empty there.
  useSeenOnOpen(profile !== null && handle !== null && !own ? profile.id : null);

  // Which chronicle read is the live one. A tab switch fires a new read
  // without cancelling the old, and the old one resolving afterwards would
  // overwrite the cleared list with the PREVIOUS tab's rows — and set that
  // tab's cursor, so the next page would then walk the wrong connection.
  const rowsRequest = useRef(0);

  const loadRows = useCallback(
    async (authorId: string, which: ChronicleFilter, after: string | null, mine: boolean) => {
      const request = (rowsRequest.current += 1);
      setRowsLoading(true);
      setPageFailed(false);
      const outcome = await fetchAuthorRecords(client, authorId, which, after, mine);
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
        const mine = me !== null && me.id === loaded.id;
        setViewer(me);
        setOwn(mine);
        setApplicant(me?.accountState === "APPLICANT");
        setFilter("everything");
        void loadRows(loaded.id, "everything", null, mine);
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
    void loadRows(profile.id, next, null, own);
  };

  // THE NEXT PAGE ARRIVES IN PLACE as the reader keeps going (Profile.md:29):
  // no Show more, no page numbers, no count of what is left.
  const nextPage = useCallback(() => {
    if (profile === null || rowsLoading || !hasMore || endCursor === null) return;
    void loadRows(profile.id, filter, endCursor, own);
  }, [profile, rowsLoading, hasMore, endCursor, loadRows, filter, own]);
  const tailRef = useApproachingTail({
    root: host,
    onReach: nextPage,
    enabled: hasMore && !pageFailed && !rowsLoading,
  });
  const tailIndex = tailIndexOf(rows.length);
  // `Loading…` stands only once a next page is 200ms late (Profile.md:33).
  const [loadingShown, setLoadingShown] = useState(false);
  const paging = rowsLoading && rows.length > 0;
  useEffect(() => {
    if (!paging) {
      setLoadingShown(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingShown(true), LOADING_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [paging]);

  // A DELETED ACCOUNT READS OFF ITS REDACTED STATUS (ER-G10, design digest
  // item 19): the wire serves null values and the mark.
  const deleted = profile?.displayName.status === "REDACTED";
  const comfort = useComfortLine(profile?.id ?? "");
  const back = backFor(from);
  // Where a chronicle card's post, and the chats, say they were opened from.
  const origin = own && handle === null ? "profile" : profile ? personOrigin(profile.handle) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col pb-2">
      <CollapsingTop flush>
        {handle === null ? (
          // THE OWN PROFILE ROOT WEARS THE BAND (`ProfileBand`, Profile.md:3):
          // the gear, then chats, then the bell — and no ⋮, which closes the
          // actions row instead.
          <CograBand
            node={{ path: "profile.band" }}
            trailing={
              <Link
                href="/settings"
                aria-label="Settings"
                data-testid="profile.band.gear"
                className="cg-state cg-focus cg-hit grid size-10 flex-none place-items-center rounded-full text-on-surface-variant"
              >
                <Icon name="settings" size={22} />
              </Link>
            }
            onChats={phase === "signedIn" ? () => router.push("/chats?from=profile") : undefined}
            bell={
              phase === "signedIn"
                ? { lit: bellIsLit, onOpen: () => router.push(notificationsHref("profile")) }
                : undefined
            }
          >
            {own && keyOnDevice === false && (
              <div className="flex flex-col gap-4 px-6 pb-2">
                <RestoreCard />
              </div>
            )}
          </CograBand>
        ) : (
          // A DRILL-IN'S BAR CARRIES THE WAY BACK ALONE, titled with the
          // person's handle (ProfileOther.md:3) — and with nothing on a deleted
          // account, whose handle went with the rest (ProfileDeleted.md:11).
          <>
            <PageHeader
              node={{ path: "profile.header" }}
              title={profile === null ? undefined : deleted ? undefined : `@${profile.handle}`}
              backHref={back.href}
              backScroll={false}
              backLabel={back.label}
              backTestId="profile-back"
            />
            {own && keyOnDevice === false && (
              <div className="flex flex-col gap-4 px-6 pb-2">
                <RestoreCard />
              </div>
            )}
          </>
        )}
      </CollapsingTop>
      {/* The account-status banners ride the reader's own page (design.md §6);
          an empty section takes no room. */}
      {own && (
        <div className="flex flex-col px-4 [&:has(>section:not(:empty))]:py-2">
          <StatusBanners />
        </div>
      )}
      {loading && (
        <p role="status" aria-live="polite" data-testid="profile-loading" className="px-4 py-2">
          Loading…
        </p>
      )}
      {notFound && (
        <p data-testid="profile-not-found" className="px-4 py-2">
          This profile doesn&apos;t exist.
        </p>
      )}
      {transportFailed && profile === null && !loading && !notFound && (
        <div className="flex items-center gap-3 px-4 py-2">
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
          <div className="px-4">
            <ProfileHeader
              node={IDENTITY}
              handle={profile.handle}
              displayName={profile.displayName.value}
              avatarSrc={profile.avatar?.url}
              bio={profile.bio.value}
              website={profile.websiteUrl.value}
              redacted={deleted}
              // The handle repeats only where the bar does not carry it: the
              // own root's band carries none.
              showHandle={handle === null}
            >
              {own ? (
                <>
                  <Link
                    href="/profile/edit"
                    data-testid="profile.identity.actionRow.edit"
                    className={`${buttonClassName({ variant: "outline", size: "sm" })} min-w-0 flex-1`}
                  >
                    Edit profile
                  </Link>
                  {/* AN APPLICANT'S INVITES IS LOCKED, NOT GONE
                      (ProfileApplicant.md:15-17; auth.md's locked look): the
                      disabled opacity, still tappable, the tap answering in
                      the snackbar — never a gate screen. */}
                  {applicant ? (
                    <button
                      type="button"
                      data-testid="profile.identity.actionRow.invites"
                      onClick={() => notify(INVITE_LOCKED)}
                      className={`${buttonClassName({ variant: "outline", size: "sm" })} min-w-0 flex-1 opacity-[var(--state-disabled)]`}
                    >
                      Invites
                    </button>
                  ) : (
                    <Link
                      href="/invites"
                      data-testid="profile.identity.actionRow.invites"
                      className={`${buttonClassName({ variant: "outline", size: "sm" })} min-w-0 flex-1`}
                    >
                      Invites
                    </Link>
                  )}
                  {/* YOUR OWN ⋮, closing the actions row (`ownProfileMenu`):
                      Saved, History, Share your profile. */}
                  <ProfileMenu kind="own" profile={profile} signedIn notify={notify} />
                </>
              ) : (
                <>
                  {/* THE OPINION ON THE PERSON LEADS, worn wide (ProfileOther.md:9;
                      `StanceControl` `wide`): the row's one action, taking what
                      Message and the ⋮ leave. A deleted account is named `this
                      account`, never a handle (ProfileDeleted.md:25). */}
                  <div className="flex min-w-0 flex-1">
                    <StanceControl
                      wide
                      node={ROW("stance")}
                      target={{
                        id: profile.id,
                        kind: "profile",
                        label: deleted ? "this account" : `@${profile.handle}`,
                      }}
                      testIdPrefix="profile-stance"
                      // THE VOUCH-BACK STAYS OPEN FROM HERE (VouchBack.md:51): on
                      // the member who vouched the reader in, the anchor's tap
                      // opens the vouch-back pad (ProfileOther.md:35) and any
                      // signing taken on it — Set or the hold — opens the
                      // ceremony (:37). Cancel closes back onto this profile
                      // (VouchBackPad.md:47).
                      variant={
                        viewer !== null && opensVouchBackOn(viewer, profile.id)
                          ? vouchBackVariant(() => router.push(VOUCHED_IN_PATH))
                          : undefined
                      }
                    />
                  </div>
                  {/* MESSAGE, SIZED BY ITS WORD (ProfileHeader.jsx): the chats
                      coming-soon screen, or the guest gate (ProfileOther.md:53-55).
                      A deleted account has no person left to address
                      (ProfileDeleted.md:21). */}
                  {!deleted && (
                    <button
                      type="button"
                      data-testid="profile.identity.actionRow.message"
                      onClick={() =>
                        phase === "signedIn"
                          ? router.push(`/chats?from=${encodeURIComponent(personOrigin(profile.handle))}`)
                          : setJoinOpen(true)
                      }
                      className={`${buttonClassName({ variant: "outline" })} flex-none`}
                    >
                      Message
                    </button>
                  )}
                  {/* THE ⋮ CLOSES THE ACTIONS ROW (`otherProfileMenu`,
                      `deletedProfileMenu`). */}
                  <ProfileMenu
                    kind={deleted ? "deleted" : "other"}
                    profile={profile}
                    signedIn={phase === "signedIn"}
                    notify={notify}
                  />
                </>
              )}
            </ProfileHeader>
            {/* THE ROW LINE IN THE ACTIONS ROW (design digest item 46): a save or
                unsave of this person that did not go through. */}
            {comfort !== null && <RowLine state={comfort} testId="profile-row-line" />}
          </div>
          <TabBar
            tabs={CHRONICLE_TABS}
            value={filter}
            ariaLabel={CHRONICLE_TABS_LABEL}
            onSelect={onFilter}
            node={{ path: "profile.tabRow" }}
            testId="profile-tabs"
          />
          {/* THE CHRONICLE (`ChronicleList`): one act to a card on 8px of
              surface, newest first, each keyed by its position. */}
          <div data-testid="profile.chronicle" className="flex flex-col gap-2 px-4 pt-2">
            {rows.length === 0 && !rowsLoading && !pageFailed && (
              <EmptyState
                testId="profile-chronicle-empty"
                node={applicant && own ? { path: "profile.chronicle.empty" } : undefined}
                title={applicant && own ? APPLICANT_CHRONICLE_EMPTY : "Nothing here yet."}
              />
            )}
            {rows.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="profile-chronicle">
                {rows.map((row, index) => (
                  <li key={row.id} ref={index === tailIndex ? tailRef : undefined}>
                    <ChronicleAct row={row} position={index + 1} origin={origin} />
                  </li>
                ))}
              </ul>
            )}
            {rowsLoading && rows.length === 0 && (
              <p role="status" aria-live="polite" data-testid="profile-rows-loading" className="py-2">
                Loading…
              </p>
            )}
            {loadingShown && (
              <p role="status" aria-live="polite" data-testid="profile-rows-loading" className="py-2">
                Loading…
              </p>
            )}
            {/* THE PAGE THAT DID NOT ARRIVE (Profile.md:35): the quiet line and
                Retry where the next page would have stood — never the error
                colour. */}
            {pageFailed && (
              <div className="flex items-center gap-3" role="alert">
                <span className="text-body-medium text-on-surface-variant" data-testid="profile-rows-failed">
                  {COULDNT_LOAD_MORE}
                </span>
                <Button
                  testId="profile-rows-retry"
                  variant="text"
                  size="sm"
                  onClick={() => profile && void loadRows(profile.id, filter, endCursor, own)}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      {joinOpen && <JoinPrompt open onClose={() => setJoinOpen(false)} />}
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

/** Each act's disc, by kind (`_shared.jsx` `ProfileOwnBody`'s chronicle). */
function discOf(row: RecordRow): ContentRowDisc {
  switch (row.kind) {
    case "post":
      return { kind: "glyph", glyph: "dynamic_feed" };
    case "comment":
      return { kind: "glyph", glyph: "chat_bubble" };
    case "profile":
      return { kind: "glyph", glyph: "person" };
    case "opinion":
      // The stance record's own face — which (0, 0) it is, from the record's
      // own `severed` (ContentRow's `face`).
      return row.face === null
        ? { kind: "glyph", glyph: "history" }
        : {
            kind: "face",
            pDirected: row.face.pDirected,
            pInterest: row.face.pInterest,
            zeroLabel: row.face.severed ? undefined : EMPTY_PICK_LABEL,
          };
    default:
      return { kind: "glyph", glyph: "history" };
  }
}

/**
 * One act (`ContentRow` chronicle): its disc, its verb and snippet, its age on
 * the trailing edge. A card with somewhere to go opens its post, whose back
 * arrow names this profile; one with nowhere to go is the same card, inert.
 */
function ChronicleAct({
  row,
  position,
  origin,
}: {
  row: RecordRow;
  position: number;
  origin: string | null;
}) {
  const node = instance(CHRONICLE, "act", String(position));
  const href =
    row.postId === null
      ? undefined
      : origin === null
        ? `/posts/${row.postId}`
        : `/posts/${row.postId}?from=${encodeURIComponent(origin)}`;
  return (
    <ContentRow
      variant="chronicle"
      title={row.label}
      titleAside={row.aside ?? undefined}
      second={row.snippet?.trim() ? row.snippet : undefined}
      trailing={ladderAge(row.landedAt)}
      disc={discOf(row)}
      href={href}
      node={node}
      testId={`chronicle-row-${row.id}`}
    />
  );
}
