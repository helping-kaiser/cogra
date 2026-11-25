"use client";

// The topic route (D20, roadmap "Slice 2.3 — Topics"; TagPage.dc.html,
// screens/TagPage.jsx `TagPageBody`): the header titled by the tag, the
// topic's own row, and the tagged content list — the content-intrinsic
// channel only this slice (D8).
//
// THE HEADER CARRIES NO CONTROL AND THE ROW BELOW IT DOES (`TagPage`,
// the topic round 2026-09-14). A stance anchor on the header's trailing
// edge read as a stance readout for the post the reader arrived from; a
// row of its own, under the title and above anything belonging to a
// post, cannot. THE GESTURE IS AN AFFINITY — the same ceremony every
// stance uses, wearing the family's own six words (`AFFINITY_AXES`) —
// so there is no toggle and no one-tap follow, and the word "follow" is
// not on the screen (copy-voice's ban, extended to topics). The row is
// `TopicStanceRow`: the wide anchor, then the tag's share.
//
// A GUEST REACHES IT LIKE ANYONE ELSE (backlog item 81, ruled
// 2026-09-15). The page is public, the face wears the no-opinion 🫥 that
// a viewer with no bundle always wears, and the tap raises the join
// prompt — all of which the control already does behind `signedIn`.
//
// THE EMPTY PAGE CARRIES THE ROW TOO, holding nothing (TagPageEmpty.md:9):
// a topic nothing carries yet is still a topic to take a position on.
//
// EVERY ROW IS ITS CLAIM, THEN ITS CARD (`TaggedRow`): a post as its post
// card, a comment as its card in the line shape `ProfileComments` draws,
// leading with the thread it answers — no Reply and no view-replies line
// (TagPage.md:15-17), its ⋮ the comment's whole menu (:19).
//
// `hashtag(name:)` resolves any well-formed name (D4) — a Type is
// anchored vacuously, so a topic nobody has tagged yet still renders a
// page with nothing in its list. `null` answers only a
// substrate-illegal name, which reads as "not found" here.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { PostView } from "@/lib/api/content-api";
import type { Removal } from "@/lib/api/removal-api";
import { readCommittedFeedFilter } from "@/lib/feed/committed-filter";
import { admitsRemoved } from "@/lib/feed/feed-predicates";
import { readReaderDefault } from "@/lib/feed/reader-default";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { fetchHashtagDetail, type HashtagDetail } from "@/lib/api/topics-api";
import { useHostSnack } from "@/lib/saved/save-row";
import { SEEN_ATTRIBUTE, useSeenTracker } from "@/lib/history/seen-tracker";
import { backFor, EXPLORE_COLD, tagOrigin, tagPageHref } from "@/lib/ui/back-origin";
import { Button } from "@/lib/ui/button";
import { CommentFeedCard } from "@/lib/ui/comment-feed-card";
import { EmptyState } from "@/lib/ui/empty-state";
import { useLineCut } from "@/lib/ui/line-cut";
import { useNameFit } from "@/lib/ui/name-fit";
import { PageHeader } from "@/lib/ui/page-header";
import { PostCard } from "@/lib/ui/post-card";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { LINK_COPIED } from "@/lib/ui/share";
import { ShareButton } from "@/lib/ui/share-button";
import { StanceControl } from "@/lib/ui/stance-control";
import { AFFINITY_AXES } from "@/lib/ui/stance-format";
import { Snackbar } from "@/lib/ui/snackbar";
import { TaggedRow } from "@/lib/ui/tagged-row";
import { TransportError } from "@/lib/ui/transport-error";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { menuSheetNodes } from "@/lib/ui2/overflow-menu";
import { PostMenuHost } from "@/lib/ui2/post-menu-host";

/** The page's registered prefix (nodes.json `TagPage`, round 60). */
const NODE = "tagPage";
/** The full-name heading's smallest size (TagPage.md:9; jakob 2026-11-23). */
const TAG_NAME_FLOOR = 12;

/** The first read got no answer (TagPage.jsx, round 48; copy-voice *No answer at all*). */
export const TAG_UNREACHABLE = "Can't reach the server — this tag can't load right now.";
/** A name that breaks the naming gate (TagPage.jsx, jakob 2026-11-13, N4). */
export const TAG_NOT_FOUND = "This tag doesn't exist.";
/** A legal name nothing carries (TagPageEmpty.md:3). */
export const TAG_EMPTY = "Nothing carries this tag right now.";

export function TopicView({ name, from = null }: { name: string; from?: string | null }) {
  const client = useApolloClient();
  const [hashtag, setHashtag] = useState<HashtagDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // THE PAGE'S ONE SNACKBAR (`tagPage.snackbar`, TagPageHidden): a card's
  // copied link and every aftermath of a card's menu — a hide's Undo, a save.
  const { snack, notify, dismiss } = useHostSnack();
  // A POST CARD'S MENU, OVER THE TAG'S PAGE (TagPageMenu.md:3): the one post
  // menu every host shares, its sheet `tagPage.menuSheet`.
  const [menuPost, setMenuPost] = useState<PostView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // THE FEED'S FILTER, AS THE FEED OPENS WITH IT: the one committed in the
  // feed on this device, else the reader's saved default (`feed-view.tsx`).
  const phase = useAuthPhase();
  const account = useActiveAccountId();
  const reader = phase === "signedIn" ? account : null;

  const refresh = useCallback(() => {
    let cancelled = false;
    void fetchHashtagDetail(client, name).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        // hashtag stays null; the transport-fault branch below reads
        // exactly that, distinguished from notFound by the flag.
        return;
      }
      if (outcome.value === null) {
        setNotFound(true);
      } else {
        setNotFound(false);
        // THE TAG PAGE FOLLOWS THE FEED'S REMOVED SWITCH (TagPage.md:23-25):
        // read when the page is derived, so a removal taken from this page's
        // own menus stands as its mark until the next read. A removed post
        // and a removed comment alike (round 58).
        const feedFilter = readCommittedFeedFilter(reader) ?? readReaderDefault(reader);
        setHashtag({
          ...outcome.value,
          taggedContent: outcome.value.taggedContent.filter(({ node }) => admitsRemoved(feedFilter, node)),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, name, reader]);

  useEffect(() => refresh(), [refresh]);

  // A POST OR COMMENT CARD WHOLLY ON SCREEN JOINS HISTORY (History.md:5) —
  // the card's own node, never its author or the topic. The topic's own
  // header is a page rendering, not tracked in H1 (`seen-tracker.ts`).
  const host = useScrollHost();
  const listRef = useRef<HTMLUListElement>(null);
  const seenIds = useMemo(
    () =>
      (hashtag?.taggedContent ?? []).flatMap(({ node }) =>
        node.__typename === "Post" || node.__typename === "Comment" ? [node.id] : [],
      ),
    [hashtag],
  );
  useSeenTracker({ root: host, list: listRef, ids: seenIds });

  // THE BACK ARROW NAMES THE LIST THE PAGE WAS OPENED FROM (the origin-naming
  // table; History.md:57: `Back to History`; Explore mid-query, `Back to the
  // search`), and Explore when nothing is behind it (TagPage.md:51: a shared
  // URL reads `Back to Explore`).
  const back = backFor(from, EXPLORE_COLD);
  // EVERY DOOR OUT OF THE PAGE NAMES IT AND THE ORIGIN IT WAS OPENED WITH
  // (`tagOrigin`, the chain; jakob 2026-11-10, grandfathered): what it opens
  // reads `Back to #<thattag>` (readme §13's origin-noun tables) and keeps lit
  // the root this page was itself opened from — the feed's, Explore's or the
  // profile's.
  const doorFrom = tagOrigin(name, from);
  const doorQuery = `?from=${encodeURIComponent(doorFrom)}`;
  // THE TITLE IS THE TAG, HASH AND ALL (TagPage.md:3) — the name the read
  // answers once there is one, the name asked for until then and on the two
  // pages that answer no (TagPage.jsx: "keep the asked for name"). Only the
  // loaded page wears the registered header: "The failed and not-found
  // states stay unnamed."
  //
  // THE FULL NAME (TagPage.md:5-11; jakob 2026-11-23, "only on the tags page
  // itself we show the full tags name when it is too long"): the header's
  // title keeps its one line, cut with "…", and where that line cuts the name
  // the whole name stands under the header as a wrapping heading. "Too long"
  // is the title's own measured cut (`useLineCut`), never a count of
  // characters; only the loaded page measures, so the failed and not-found
  // headers cut and print nothing more (TagPage.md:91).
  const [holdTitle, titleCut] = useLineCut(hashtag?.name.value ?? null);
  // IT SHRINKS TO FIT (TagPage.md:9-11, round 66): the profile head's
  // two-line rule (`useNameFit`) with the heading's 12px floor.
  const [holdName, nameFit] = useNameFit<HTMLParagraphElement>(`#${hashtag?.name.value ?? ""}`, TAG_NAME_FLOOR);
  const header = (title: string, named: boolean) => (
    <PageHeader
      title={title}
      backHref={back.href}
      backScroll={false}
      backLabel={back.label}
      backTestId="topic-back"
      node={named ? { path: `${NODE}.header` } : undefined}
      titleRef={named ? holdTitle : undefined}
    />
  );
  const asked = `#${name}`;

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col pb-6">
        {header(asked, false)}
        <p className="px-6 py-2">Loading…</p>
      </main>
    );
  }

  if (notFound) {
    // THE ANSWER NO (TagPage.md:69-71): the not-found family's EmptyState in
    // the page's place — never the failure voice, never a Retry, no row.
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col pb-6">
        {header(asked, false)}
        <div className="px-6 py-2">
          <EmptyState title={TAG_NOT_FOUND} testId="topic-not-found" />
        </div>
      </main>
    );
  }

  if (hashtag === null) {
    // THE FIRST READ GOT NO ANSWER (TagPage.md:65): the house line's noun
    // form in the page's place, over an outlined Retry leading the column.
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col pb-6">
        {header(asked, false)}
        <div className="flex flex-col items-start gap-3 px-6 py-4">
          <TransportError testId="topic-transport-error" message={TAG_UNREACHABLE} />
          <Button
            testId="topic-retry"
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
      </main>
    );
  }

  const tagName = hashtag.name.value;
  const removedFrom = (id: string, removal: Removal) =>
    setHashtag((current) =>
      current === null
        ? current
        : {
            ...current,
            taggedContent: current.taggedContent.map((item) =>
              item.node.__typename === "Comment" && item.node.id === id
                ? { ...item, node: { ...item.node, removal } }
                : item,
            ),
          },
    );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col pb-6">
      {header(`#${tagName ?? ""}`, true)}
      {/* PRINT ONLY (TagPage.jsx `TagFullName`): the header's title already
          speaks the whole name, so the heading is hidden from the
          accessibility tree; title-large, wrapping at its hyphens and
          breaking inside a run that has none (`overflow-wrap: break-word`). */}
      {tagName !== null && titleCut && (
        <p
          ref={holdName}
          aria-hidden="true"
          data-testid={`${NODE}.name`}
          style={nameFit === null ? undefined : { fontSize: nameFit.size, lineHeight: `${nameFit.lineHeight}px` }}
          className="m-0 px-4 pt-1 text-title-large break-words"
        >
          #{tagName}
        </p>
      )}
      {/* THE TOPIC'S ROW (`TopicStanceRow`): under the title, above anything
          belonging to a post — the wide anchor, then the tag's share. It
          NAMES WHAT IT STANCES — the tag itself, hash and all — because
          more than one stance control stands on this page and the face's
          accessible name is what says which is which.

          A name moderation has taken away is a topic with nothing to
          stance toward: the canonical name IS the target's identity
          (hashtag.md §1), so the row waits for one rather than signing
          against a blank. */}
      {tagName !== null && (
        <div data-testid={`${NODE}.actionRow`} className="flex items-center gap-2 px-4 pb-2 pt-1">
          <div className="min-w-0 flex-1">
            <StanceControl
              target={{ id: tagName, kind: "topic", label: `#${tagName}` }}
              testIdPrefix="topic-affinity"
              axes={AFFINITY_AXES}
              wide
              node={{ path: `${NODE}.actionRow.stance` }}
              padNode={{ path: `${NODE}.actionRow.stance.pad` }}
            />
          </div>
          <ShareButton
            href={tagPageHref(tagName)}
            targetLabel={`#${tagName}`}
            onCopied={() => notify(LINK_COPIED)}
            node={{ path: `${NODE}.actionRow.share` }}
          />
        </div>
      )}
      {hashtag.taggedContent.length === 0 && (
        // `tagPage.empty` is the empty state's own box (EmptyState.jsx); the
        // board's 4px 24px 0 wrapper around it is the page's, unregistered
        // (TagPageEmpty.jsx).
        <div className="px-6 pt-1">
          <EmptyState title={TAG_EMPTY} testId="topic-empty" node={{ path: `${NODE}.empty` }} />
        </div>
      )}
      {/* THE TAG PAGE'S ONE STAGE: "ALWAYS at most one clip plays on the tag
          page, by the feed's stage law" (TagPage.md:35), re-electing at the
          page's own hard top (TagPage.md:41/43). */}
      <StageHost>
        <ul ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0 pt-1" data-testid="topic-content-list">
          {hashtag.taggedContent.map((item) => {
            const node = item.node;
            // EVERY ROW CARRIES THE CLAIM ABOVE IT (TagPage.md:27), keyed by
            // the tagged thing's id — the key rule `claim`.
            const claim = (id: string, card: ReactNode) => (
              <TaggedRow
                relevance={item.relevance}
                confidence={item.confidence}
                pending={item.pending}
                node={{ path: `${NODE}.claim`, key: id }}
                testId={`topic-claim-${id}`}
              >
                {card}
              </TaggedRow>
            );
            if (node.__typename === "Post") {
              return (
                <li key={node.id} {...{ [SEEN_ATTRIBUTE]: node.id }}>
                  {claim(
                    node.id,
                    <PostCard
                      post={node}
                      href={`/posts/${node.id}${doorQuery}`}
                      // THE SCORE OPENS ITS TRACE, whose back arrow reads `Back to #<thattag>`.
                      scoreOrigin={{ kind: "tag", name, from }}
                      doorFrom={doorFrom}
                      // THE PAGE'S OWN TAG IS INERT ON IT (jakob, hand test
                      // 2026-11-23): "same tag" is the name the read answers,
                      // canonical (hashtag.md §1), never the name asked for.
                      tagHere={tagName}
                      testId={`topic-post-${node.id}`}
                      authorTestId={`topic-author-${node.id}`}
                      stanceTestId={`topic-stance-${node.id}`}
                      node={{ path: `${NODE}.card`, key: node.id }}
                      attach
                      comments={node.comments.totalCount}
                      onLinkCopied={() => notify(LINK_COPIED)}
                      onOpenMenu={() => {
                        setMenuPost(node);
                        setMenuOpen(true);
                      }}
                      menuOpen={menuOpen && menuPost?.id === node.id}
                    />,
                  )}
                </li>
              );
            }
            if (node.__typename === "Comment") {
              return (
                <li key={node.id} {...{ [SEEN_ATTRIBUTE]: node.id }}>
                  {claim(
                    node.id,
                    <CommentFeedCard
                      comment={node}
                      shape="line"
                      // NO REPLY AND NO VIEW-REPLIES LINE (TagPage.md:17):
                      // on this page a card is a doorway, not a thread.
                      reply="none"
                      from={doorFrom}
                      tagHere={tagName}
                      testId={`topic-comment-${node.id}`}
                      node={{ path: `${NODE}.commentCard`, key: node.id }}
                      attach
                      onNotify={notify}
                      onLinkCopied={() => notify(LINK_COPIED)}
                      // The author's own Remove from the card's ⋮: the row
                      // keeps the mark until the page is next derived.
                      onRemoved={(removal) => removedFrom(node.id, removal)}
                    />,
                  )}
                </li>
              );
            }
            // Future Taggable node kinds (Item, Chat) join without a
            // dedicated card yet — skip rather than guess a rendering.
            return null;
          })}
        </ul>
      </StageHost>
      {/* One region for the list: a copied link, a menu's aftermath. */}
      <Snackbar
        testId="topic-snackbar"
        node={{ path: "tagPage.snackbar" }}
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismiss}
      />
      {/* HIDING LEAVES THE PAGE AS IT STOOD (TagPageMenu.md:5): the page
          filters nobody at the tap, so no row moves. A removal taken from the
          author's own menu stands the card as its mark in place (RM-G9). */}
      <PostMenuHost
        post={menuPost}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nodes={menuSheetNodes("tagPage")}
        testId="topic-menu"
        notify={notify}
        onRemoved={(removed) =>
          setHashtag((current) =>
            current === null
              ? current
              : {
                  ...current,
                  taggedContent: current.taggedContent.map((item) =>
                    item.node.__typename === "Post" && item.node.id === removed.id
                      ? { ...item, node: { ...item.node, removal: removed.removal } }
                      : item,
                  ),
                },
          )
        }
      />
    </main>
  );
}
