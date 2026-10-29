// The queue's laws, as data: Invites.md:9-29, InviteNew.md, InviteExpiry.md,
// RejectAllConfirm.md:3-11, and the origin's back words (:95-97).

import { describe, expect, it } from "vitest";

import { applicationNode, application, daysAgo, daysAhead, MANY, NOW, USED, inviteLink } from "@/test/invites";
import type { ApplicationView, InviteLinkView } from "@/lib/api/invites-api";
import {
  DEFAULT_EXPIRY,
  EXPIRY_CHOICES,
  groupClosesAll,
  groupLabel,
  invitesOrigin,
  layoutQueue,
  linkCaption,
  linkLabel,
  liveLinks,
  rejectAllBody,
  rejectAllTitle,
  secondLine,
} from "./queue";

const view = (overrides: Parameters<typeof application>[0]) =>
  applicationNode(application(overrides)) as unknown as ApplicationView;

describe("the order law (Invites.md:9-13)", () => {
  const queue = [
    view({ handle: "rafa", createdAt: daysAgo(3), link: USED }),
    view({ handle: "vora81", createdAt: daysAgo(1), link: MANY }),
    view({ handle: "imke", createdAt: daysAgo(9), link: MANY, keyAttached: false }),
    view({ handle: "noor", createdAt: daysAgo(2), link: null }),
  ];

  it("groups by link, groups by their oldest row, rows by age — never by readiness", () => {
    const { head, groups } = layoutQueue(queue);
    expect(head.map((a) => a.handle)).toEqual(["noor"]);
    expect(groups.map((g) => g.linkId)).toEqual([MANY.id, USED.id]);
    // @imke is not ready and still stands first: age alone orders (:13).
    expect(groups[0].rows.map((a) => a.handle)).toEqual(["imke", "vora81"]);
  });

  it("stands only what waits", () => {
    const { groups } = layoutQueue([
      view({ handle: "a", approvedAt: daysAgo(1) }),
      view({ handle: "b", rejectedAt: daysAgo(1) }),
      view({ handle: "c", landedAt: daysAgo(1) }),
      view({ handle: "d" }),
    ]);
    expect(groups.flatMap((g) => g.rows.map((a) => a.handle))).toEqual(["d"]);
  });

  it("labels a group by its link and what waits, and batches only past one", () => {
    const { groups } = layoutQueue(queue);
    expect(groupLabel(groups[0])).toBe("Many uses · 2 waiting");
    expect(groupLabel(groups[1])).toBe("Single use · 1 waiting");
    expect(groupClosesAll(groups[0])).toBe(true);
    expect(groupClosesAll(groups[1])).toBe(false);
  });
});

describe("the second line (Invites.md:21, :73)", () => {
  it("is the reader's fact, never the missing proof", () => {
    expect(secondLine(view({}))).toBe("Ready for your approval");
    expect(secondLine(view({ keyAttached: false }))).toBe("Not fully registered yet");
    expect(secondLine(view({ emailVerified: false }))).toBe("Not fully registered yet");
    expect(secondLine(view({}), true)).toBe("Waiting for your key");
  });
});

describe("the links (Invites.md:27-29)", () => {
  const link = (o: Parameters<typeof inviteLink>[0]) => inviteLink(o) as unknown as InviteLinkView;

  it("stand only while they work", () => {
    const links = [link({ id: "a" }), link({ id: "b", usable: false }), link({ id: "c" })];
    expect(liveLinks(links).map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("say what they are and when they die", () => {
    expect(linkLabel({ singleUse: true })).toBe("Single use · not used yet");
    expect(linkLabel({ singleUse: false })).toBe("Many uses");
    const caption = linkCaption({ expiresAt: daysAhead(7) }, NOW);
    expect(caption).toMatch(/^Expires in 7 days · \d\d\.\d\d\.2026$/);
  });
});

describe("the create sheet's lengths (InviteNew.md:9, InviteExpiry.md:5)", () => {
  it("offers three lengths and opens at 7 days", () => {
    expect(EXPIRY_CHOICES.map((c) => c.label)).toEqual(["24 hours", "7 days", "30 days"]);
    expect(DEFAULT_EXPIRY.label).toBe("7 days");
  });
});

describe("the batch dialog's words (RejectAllConfirm.md:3-9)", () => {
  it("puts the count in the title and names no handles", () => {
    expect(rejectAllTitle(4)).toBe("Close all 4 applications from this link?");
    expect(rejectAllBody(4)[0]).toBe(
      "All four leave your list and all four people are told. Their accounts stay exactly as they are — signed in, and free to keep reading.",
    );
  });
});

describe("the back arrow names its door (Invites.md:97)", () => {
  it.each([
    [null, "/profile", "Back to your profile"],
    ["notifications", "/notifications", "Back to Notifications"],
    ["kept-picks", "/kept-picks", "Back to Kept picks"],
  ])("from %s", (from, href, label) => {
    expect(invitesOrigin(from)).toEqual({ href, label });
  });
});
