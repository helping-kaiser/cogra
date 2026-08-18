"use client";

// The profile screen (roadmap "Slice 2.1"; design.md §6 "Profile
// header"): monogram avatar, name, handle, bio, link — and the
// authored chronicle under filter chips. The header's
// connection count and the connections sections arrive with the
// stance slice (open-questions Q35); media covers with slice 2.5.
// Shared by /u/<handle> (public) and /profile (the viewer's own tab).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe } from "@/lib/api/auth-api";
import {
  fetchAuthorRecords,
  fetchMyProfile,
  fetchProfileByHandle,
  type ChronicleFilter,
  type ProfileView as Profile,
  type RecordRow,
} from "@/lib/api/profile-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { useAuthPhase } from "@/lib/session/provider";
import { StatusBanners } from "@/app/status-banners";
import { MonogramAvatar } from "@/lib/ui/actor-chip";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { TransportError } from "@/lib/ui/transport-error";

const FILTERS: readonly { key: ChronicleFilter; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "comments", label: "Comments" },
  { key: "everything", label: "Everything" },
];

export function ProfileScreen({ handle }: { handle: string | null }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();

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

  const loadRows = useCallback(
    async (authorId: string, which: ChronicleFilter, after: string | null) => {
      setRowsLoading(true);
      setPageFailed(false);
      const outcome = await fetchAuthorRecords(client, authorId, which, after);
      setRowsLoading(false);
      if (outcome.kind === "success") {
        setRows((current) => (after === null ? outcome.value.items : [...current, ...outcome.value.items]));
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
    return refresh();
  }, [refresh, phase]);

  const onFilter = (next: ChronicleFilter) => {
    if (next === filter || profile === null) return;
    setFilter(next);
    setRows([]);
    setEndCursor(null);
    setHasMore(false);
    void loadRows(profile.id, next, null);
  };

  const name = profile?.displayName.value?.trim() ? profile.displayName.value : profile?.handle;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-6 pt-3">
      <PageHeader
        title={profile ? `@${profile.handle}` : "Profile"}
        backHref={handle === null ? undefined : "/feed"}
        backLabel="Back to feed"
        backTestId="profile-back"
        action={
          own ? (
            <Link
              href="/settings"
              aria-label="Settings"
              data-testid="profile-settings"
              className={buttonClassName({ variant: "text", size: "sm" })}
            >
              Settings
            </Link>
          ) : undefined
        }
      />
      {own && <StatusBanners />}
      {loading && <p data-testid="profile-loading">Loading…</p>}
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
              <MonogramAvatar name={name ?? "?"} size="lg" />
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
