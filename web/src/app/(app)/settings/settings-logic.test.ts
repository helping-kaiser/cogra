import { describe, expect, it } from "vitest";

import {
  emailDestination,
  noticeMessage,
  orderedSessions,
  sessionStatus,
  signOutPath,
} from "./settings-logic";

describe("signOutPath (Settings.md:123-127)", () => {
  it("the switch off ends the session and keeps everything", () => {
    expect(signOutPath({ forget: false, keyHere: true, backed: false })).toBe("plain");
  });

  it("the switch on clears without asking when a backup is known", () => {
    expect(signOutPath({ forget: true, keyHere: true, backed: true })).toBe("purge");
  });

  it("the switch on clears without asking when the key is not here at all", () => {
    expect(signOutPath({ forget: true, keyHere: false, backed: false })).toBe("purge");
  });

  it("the switch on asks first for the only copy of an unbacked key — unknown counts as unbacked", () => {
    expect(signOutPath({ forget: true, keyHere: true, backed: false })).toBe("ask");
  });
});

describe("emailDestination", () => {
  const change = {
    __typename: "PendingEmailChange" as const,
    newEmail: "b@example.com",
    requiresCode: true,
    codeConfirmed: false,
    linkConfirmed: false,
    expiresAt: "2026-10-08T12:00:00Z",
  };

  it("an unverified applicant opens their own change, even while one is pending (G2)", () => {
    expect(emailDestination({ emailVerified: false, pendingEmailChange: change })).toBe("applicantChange");
  });

  it("a change with a side owed opens its confirmation", () => {
    expect(emailDestination({ emailVerified: true, pendingEmailChange: change })).toBe("confirmation");
  });

  it("no change, or one that ran out, opens the request", () => {
    expect(emailDestination({ emailVerified: true, pendingEmailChange: null })).toBe("request");
  });
});

describe("the sessions", () => {
  const at = (days: number) => new Date(Date.UTC(2026, 9, 7) - days * 86_400_000).toISOString();
  const now = Date.UTC(2026, 9, 7);

  it("stand this device first", () => {
    const ordered = orderedSessions([
      { id: "a", deviceLabel: null, createdAt: at(1), lastUsedAt: null, isCurrent: false },
      { id: "b", deviceLabel: null, createdAt: at(1), lastUsedAt: null, isCurrent: true },
    ]);
    expect(ordered.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("read the platform noun for this one and the ladder for the rest", () => {
    const base = { id: "a", deviceLabel: null, createdAt: at(40) };
    expect(sessionStatus({ ...base, lastUsedAt: null, isCurrent: true }, now)).toBe("This browser");
    expect(sessionStatus({ ...base, lastUsedAt: at(2), isCurrent: false }, now)).toBe("Last used 2d");
    // Never used since issue: the issue is the last use.
    expect(sessionStatus({ ...base, lastUsedAt: null, isCurrent: false }, now)).toMatch(
      /^Last used \d\d\.\d\d\.2026$/,
    );
  });
});

describe("noticeMessage", () => {
  const account = {
    handle: "solferreira",
    email: "sol@ferreira.studio",
    pendingEmailChange: { newEmail: "noor@fieldnotes.org" },
  } as never;

  it("speaks each return in the drawn words", () => {
    expect(noticeMessage("password", account)).toBe("Password changed — other devices are signed out.");
    expect(noticeMessage("handle", account)).toBe("Your handle is now @solferreira.");
    expect(noticeMessage("email", account)).toBe("Email changed to sol@ferreira.studio.");
    expect(noticeMessage("canceled", account)).toBe("Change canceled — your email stays sol@ferreira.studio.");
    expect(noticeMessage("applicantSent", account)).toBe("Sent — the link is on its way to noor@fieldnotes.org.");
  });
});
