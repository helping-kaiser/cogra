// What a notification row says and where it lands (Notifications.md:5-45;
// packet notifications-list §6.2-§6.3, §12.2).

import { describe, expect, it } from "vitest";

import type { Notification } from "@/lib/api/notifications-api";
import { backFor } from "@/lib/ui/back-origin";
import { bellRootOf, notificationRow, ROOTS } from "./row-content";

const moderated = (value: string | null, status: "NORMAL" | "REDACTED" | "SENSITIVE" = "NORMAL") => ({
  value,
  status,
});

function post(id: string, title: string | null, content = "Some words", attachments: { mimeType: string }[] = []) {
  return {
    __typename: "Post" as const,
    id,
    title: moderated(title),
    description: moderated(null),
    content: moderated(content),
    attachments,
    moderationStatus: "NORMAL" as const,
    sensitiveReason: null,
    author: { id: "u1", handle: "ada" },
  };
}

function comment(id: string, words: string, onPost = post("p1", "Salt maps of the coast road")) {
  return {
    __typename: "Comment" as const,
    id,
    content: moderated(words),
    attachments: [],
    moderationStatus: "NORMAL" as const,
    sensitiveReason: null,
    author: { id: "u2", handle: "tobias" },
    post: onPost,
  };
}

function row(kind: Notification["kind"], extra: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    kind,
    createdAt: "2026-10-14T10:00:00Z",
    readAt: null,
    actor: { id: "a1", handle: "ada", displayName: moderated("Ada Okonkwo"), avatar: null },
    subject: null,
    context: null,
    record: null,
    application: null,
    ...extra,
  } as Notification;
}

describe("notificationRow", () => {
  it("each_kind_reads_its_drawn_sentence", () => {
    const sentences: [Notification["kind"], string][] = [
      ["COMMENT", "@ada commented on your post"],
      ["REPLY", "@ada replied to your comment"],
      ["PROFILE_OPINION", "@ada gave an opinion on you"],
      ["MENTION", "@ada mentioned you"],
      ["CITATION", "@ada cited your post"],
      ["APPLICATION_APPROVABLE", "@ada is ready for your approval"],
      ["INVITE_LANDED", "@ada landed through your invite"],
      ["APPLICATION_APPROVED", "@ada approved your application"],
      ["APPLICATION_REJECTED", "@ada closed your application"],
      ["PROFILE_OPINION_WITHDRAWN", "@ada walked back their opinion on you"],
    ];
    for (const [kind, sentence] of sentences) {
      expect(notificationRow(row(kind)).title, kind).toBe(sentence);
    }
  });

  // NT-G3(b), the packet's recommendation: the reply sentence's pattern.
  it("a_citation_of_a_comment_reads_cited_your_comment", () => {
    const cited = row("CITATION", { context: { __typename: "Comment", id: "c9" } } as Partial<Notification>);
    expect(notificationRow(cited).title).toBe("@ada cited your comment");
  });

  it("comment_and_reply_rows_carry_the_words_that_arrived", () => {
    const words = "The third headland light is real —\nI have a print.";
    for (const kind of ["COMMENT", "REPLY"] as const) {
      const got = notificationRow(row(kind, { subject: comment("c1", words) } as Partial<Notification>));
      expect(got.second).toBe("The third headland light is real — I have a print.");
    }
    // NT-G3(c): a wordless comment carries no second line.
    expect(notificationRow(row("COMMENT", { subject: comment("c1", "") } as Partial<Notification>)).second).toBe(
      undefined,
    );
  });

  it("mention_and_citation_rows_read_in_the_carrying_title", () => {
    const titled = row("MENTION", { subject: post("p2", "Salt maps of the coast road") } as Partial<Notification>);
    expect(notificationRow(titled).second).toBe("in Salt maps of the coast road");
    // An untitled post is named by its first line (B11).
    const untitled = row("CITATION", {
      subject: post("p3", null, "Sunday at the tide market\nmore words"),
    } as Partial<Notification>);
    expect(notificationRow(untitled).second).toBe("in Sunday at the tide market");
    // NT-G3(a): a comment carrying it reads its thread's post.
    const byComment = row("MENTION", { subject: comment("c2", "hey @me") } as Partial<Notification>);
    expect(notificationRow(byComment).second).toBe("in Salt maps of the coast road");
  });

  it("the_opinion_row_wears_the_face_with_no_digits_and_no_second_line", () => {
    const opinion = notificationRow(
      row("PROFILE_OPINION", {
        actor: {
          id: "a1",
          handle: "sol",
          displayName: moderated("Sol"),
          avatar: { url: "https://media/sol.jpg", status: "NORMAL" },
        },
        record: { id: "act:x", pDirected: 0.4, pInterest: 0.5, severed: false },
      } as Partial<Notification>),
    );
    expect(opinion.disc).toMatchObject({ kind: "face", pDirected: 0.4, pInterest: 0.5 });
    expect(opinion.second).toBe(undefined);
    expect(opinion.title).not.toMatch(/\d/);
  });

  // THE ROW SAYS WHICH (0, 0) IT DRAWS (seam 243, design.md §8.4): the
  // record's own `severed`, never the pair, picks the word.
  it("the_opinion_row_speaks_a_walked_back_record_as_walked_back_and_an_empty_sign_as_says_nothing", () => {
    const at = (severed: boolean | null) =>
      notificationRow(
        row("PROFILE_OPINION", {
          record: { id: "act:z", pDirected: 0, pInterest: 0, severed },
        } as Partial<Notification>),
      ).disc;
    expect(at(true)).toEqual({ kind: "face", pDirected: 0, pInterest: 0, severed: true });
    expect(at(false)).toEqual({ kind: "face", pDirected: 0, pInterest: 0, severed: false });
  });

  // Notifications.md:21: 🤷 where a picture would go, no digits, no second
  // line — even for an actor with a picture, and whatever pair the record says.
  it("the_withdrawal_row_wears_the_walked_back_face_with_no_digits_and_no_second_line", () => {
    const withdrawn = notificationRow(
      row("PROFILE_OPINION_WITHDRAWN", {
        actor: {
          id: "a1",
          handle: "sol",
          displayName: moderated("Sol"),
          avatar: { url: "https://media/sol.jpg", status: "NORMAL" },
        },
        record: { id: "act:y", pDirected: -0.4, pInterest: -0.5 },
      } as Partial<Notification>),
    );
    expect(withdrawn.title).toBe("@sol walked back their opinion on you");
    expect(withdrawn.disc).toEqual({ kind: "walkedBack" });
    expect(withdrawn.second).toBe(undefined);
    expect(withdrawn.title).not.toMatch(/\d/);
  });

  it("the_approvable_row_wears_the_monogram_never_a_picture", () => {
    const ready = notificationRow(
      row("APPLICATION_APPROVABLE", {
        actor: {
          id: "a1",
          handle: "rafa",
          displayName: moderated("Rafa"),
          avatar: { url: "https://media/rafa.jpg", status: "NORMAL" },
        },
      } as Partial<Notification>),
    );
    expect(ready.disc).toEqual({ kind: "monogram", name: "rafa" });
  });

  it("other_rows_wear_the_actors_picture_else_their_monogram", () => {
    const pictured = notificationRow(
      row("APPLICATION_APPROVED", {
        actor: {
          id: "a1",
          handle: "mira",
          displayName: moderated("Mira Voss"),
          avatar: { url: "https://media/mira.jpg", status: "NORMAL" },
        },
      } as Partial<Notification>),
    );
    expect(pictured.disc).toEqual({ kind: "picture", src: "https://media/mira.jpg", name: "Mira Voss" });
    expect(notificationRow(row("INVITE_LANDED")).disc).toEqual({ kind: "monogram", name: "Ada Okonkwo" });
  });

  // Design digest items 18 and 56a: the prose reads a deleted account, the
  // disc is the reserved one.
  it("a_deleted_actor_reads_a_deleted_account_with_the_reserved_disc", () => {
    const gone = notificationRow(
      row("COMMENT", {
        actor: { id: "a1", handle: "", displayName: moderated(null, "REDACTED"), avatar: null },
      } as Partial<Notification>),
    );
    expect(gone.title).toBe("A deleted account commented on your post");
    expect(gone.disc).toEqual({ kind: "redacted" });
    expect(gone.deleted).toBe(true);
  });

  // NT-G3(e): a removed subject reads its removal.
  it("a_removed_subject_reads_removed_by_its_author", () => {
    const removed = { ...post("p2", "x"), title: moderated(null, "REDACTED"), content: moderated(null, "REDACTED") };
    expect(notificationRow(row("CITATION", { subject: removed } as Partial<Notification>)).second).toBe(
      "Removed by its author",
    );
  });

  it("a_comment_row_lands_on_its_comment_in_the_thread", () => {
    const landed = notificationRow(row("REPLY", { subject: comment("c7", "words") } as Partial<Notification>));
    expect(landed.href).toBe("/posts/p1?comment=c7&from=notifications");
  });

  it("content_and_profile_rows_land_with_back_to_notifications", () => {
    const cases: [Notification, string][] = [
      [row("MENTION", { subject: post("p2", "A") } as Partial<Notification>), "/posts/p2?from=notifications"],
      [row("CITATION", { subject: post("p3", "B") } as Partial<Notification>), "/posts/p3?from=notifications"],
      [row("PROFILE_OPINION"), "/u/ada?from=notifications"],
      // Notifications.md:43: the profile of the person who walked it back.
      [row("PROFILE_OPINION_WITHDRAWN"), "/u/ada?from=notifications"],
      [row("INVITE_LANDED"), "/u/ada?from=notifications"],
      [row("APPLICATION_APPROVED"), "/u/ada?from=notifications"],
    ];
    for (const [given, href] of cases) {
      expect(notificationRow(given).href, given.kind).toBe(href);
      expect(backFor(new URL(href, "https://x").searchParams.get("from")).label).toBe("Back to Notifications");
    }
  });

  it("the_approvable_row_opens_invites_as_it_now_stands_with_no_notice", () => {
    expect(notificationRow(row("APPLICATION_APPROVABLE")).href).toBe("/invites?from=notifications");
  });

  // NT-G4, the packet's recommendation (a): the reader's own feed as it stands.
  it("the_closed_row_opens_the_applicants_own_feed", () => {
    expect(notificationRow(row("APPLICATION_REJECTED")).href).toBe("/feed");
  });

  it("back_returns_to_the_bell_s_root_with_its_label", () => {
    expect(ROOTS[bellRootOf("feed")]).toEqual({ href: "/feed", backLabel: "Back to feed" });
    expect(ROOTS[bellRootOf("explore")].backLabel).toBe("Back to Explore");
    expect(ROOTS[bellRootOf("wallet")].backLabel).toBe("Back to Wallet");
    expect(ROOTS[bellRootOf("profile")]).toEqual({ href: "/profile", backLabel: "Back to your profile" });
    expect(bellRootOf(null)).toBe("feed");
    expect(bellRootOf("elsewhere")).toBe("feed");
  });
});
