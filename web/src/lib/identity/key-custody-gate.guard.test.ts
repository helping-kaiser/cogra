// @vitest-environment node
// THE GUARD: no key ceremony opens without asking whether this browser can hold
// a key (KeyCeremony.md:11-13, KeyCeremonyUnsupported.md:3-5, Restore.md:5).
//
// The detection stands in exactly two places — the `/key` and `/restore`
// pages, around the two ceremony views (key-custody-gate.tsx). So the guard
// pins the shape that makes that enough, and fails the moment a change
// sidesteps it:
//  1. ceremony code (minting, restoring) is called only inside the two views;
//  2. each view is imported only by its own page, and that page gates it;
//  3. every door — a control whose words open a ceremony — is in the census
//     below and opens a gated route. A new door fails here until it is added,
//     so its author is made to route it through the gate.

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SRC = new URL("../../", import.meta.url);

/** Every non-test source file under web/src, as a path relative to it. */
function sources(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .map((p) => p.replaceAll("\\", "/"))
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .filter((p) => !/\.test\.tsx?$/.test(p) && !p.startsWith("__generated__/") && !p.startsWith("test/"));
}
const read = (p: string) => readFileSync(new URL(p, SRC), "utf8");
/** Source text without comments, so a line that only mentions a door is not a door. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const KEY_VIEW = "app/(app)/key/key-ceremony-view.tsx";
const RESTORE_VIEW = "app/(app)/restore/restore-form.tsx";
const KEY_PAGE = "app/(app)/key/page.tsx";
const RESTORE_PAGE = "app/(app)/restore/page.tsx";

/** The ceremony's entry points, and the files allowed to name them in a call. */
const CEREMONY_CALL = /\brestoreActor\s*\(|\.createActorKey\s*\(|\buseKeyCeremony\s*\(/;
const CEREMONY_CALL_ALLOWED: Record<string, string> = {
  [KEY_VIEW]: "the minting ceremony itself, gated by its page",
  [RESTORE_VIEW]: "the restore itself, gated by its page",
  "lib/identity/restorer.ts": "defines restoreActor",
  "lib/signing/provider.tsx": "defines useKeyCeremony",
};

/** The words a ceremony door reads (the boards' door labels, and the web's undrawn two). */
const DOOR_WORDS = /\b(Restore the key|Restore your key|Create my key|Make a new key|Create a fresh key)\b/;
const GATED_ROUTE = /["'`]\/(key|restore)(\?[^"'`]*)?["'`]|\bKEY_CEREMONY_FROM_SETTINGS\b|\bKEY_CEREMONY_ROUTE\b|\bRESTORE_ROUTE\b/;

/**
 * THE DOOR CENSUS: every file that draws a ceremony door, where the door's
 * route is written, and the boards it stands on. A door whose control only
 * calls back (`onRestoreKey`) names the file that routes it.
 */
const DOORS: { file: string; words: string[]; routeIn?: string; boards: string }[] = [
  {
    file: "app/applicant-status.tsx",
    words: ["Create my key", "Create a fresh key", "Restore the key"],
    boards:
      "ApplicantFeed (task card, /key); the fresh-key card (no board, /key); RestoreCard (/restore): KeyElsewhere, ApplicantKeyElsewhere, ApplicantLanding, and the post editor and own profile that reuse it",
  },
  { file: "app/(app)/settings/settings-view.tsx", words: [], boards: "Settings' Recovery code and Your key rows, an applicant before any key (KeyCeremony.md:7-9)" },
  {
    file: "app/(app)/compose/wizard/seal-step.tsx",
    words: ["Restore the key"],
    routeIn: "app/(app)/compose/wizard/wizard-view.tsx",
    boards: "ComposeKeyAbsent",
  },
  {
    file: "app/posts/[id]/reply/reply-seal-step.tsx",
    words: ["Restore the key"],
    routeIn: "app/posts/[id]/reply/reply-wizard-view.tsx",
    boards: "ReplySealKeyAbsent",
  },
  { file: "lib/ui/key-absent-notice.tsx", words: ["Restore the key"], boards: "PadKeyAbsent (the pad's key notice)" },
  { file: "app/(app)/settings/backup/backup-view.tsx", words: ["Restore the key"], boards: "SettingsBackupKeyAbsent" },
  { file: "app/(app)/settings/key/key-export-view.tsx", words: ["Restore the key"], boards: "YourKeyAbsent" },
  { file: "app/profile/change-seal.tsx", words: ["Restore the key"], boards: "ProfileEditSeal / AvatarSeal, key absent" },
  { file: "lib/ui/signing-pending.tsx", words: ["Restore your key"], boards: "the signing-pending line (no board)" },
];

describe("the key-custody guard", () => {
  const files = sources();

  it("scans the tree", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files).toContain(KEY_VIEW);
    expect(files).toContain(RESTORE_VIEW);
  });

  it("ceremony code is called only inside the two gated views", () => {
    const callers = files.filter((f) => CEREMONY_CALL.test(code(f)));
    expect(callers.sort(), "a new caller of the ceremony must stand behind KeyCustodyGate").toEqual(
      Object.keys(CEREMONY_CALL_ALLOWED).sort(),
    );
  });

  it("each ceremony view is imported only by its own page, and that page gates it", () => {
    for (const [view, page, element] of [
      [KEY_VIEW, KEY_PAGE, "KeyCeremonyView"],
      [RESTORE_VIEW, RESTORE_PAGE, "RestoreForm"],
    ] as const) {
      const stem = view.replace(/\.tsx$/, "").split("/").pop() as string;
      const importers = files.filter((f) => f !== view && new RegExp(`from ["'][^"']*/${stem}["']`).test(read(f)));
      expect(importers, `${stem} may only be rendered by its gated page`).toEqual([page]);
      const src = code(page);
      const gate = src.indexOf("<KeyCustodyGate");
      const viewAt = src.indexOf(`<${element}`);
      const gateEnd = src.indexOf("</KeyCustodyGate>");
      expect(gate, `${page} renders KeyCustodyGate`).toBeGreaterThan(-1);
      expect(viewAt > gate && viewAt < gateEnd, `${page} renders ${element} inside the gate`).toBe(true);
    }
  });

  it("every door in the census opens a gated route", () => {
    for (const door of DOORS) {
      const src = code(door.file);
      for (const words of door.words) expect(src, `${door.file} draws ${words}`).toContain(words);
      expect(GATED_ROUTE.test(code(door.routeIn ?? door.file)), `${door.file}'s door (${door.boards}) opens /key or /restore`).toBe(true);
    }
  });

  it("no door stands outside the census — a new one must be routed through the gate and added here", () => {
    const census = new Set(DOORS.flatMap((d) => [d.file, d.routeIn ?? d.file]));
    const drawn = files.filter((f) => DOOR_WORDS.test(code(f)) || GATED_ROUTE.test(code(f)));
    const outside = drawn.filter(
      (f) => !census.has(f) && f !== "lib/identity/key-custody-gate.tsx" && f !== KEY_VIEW && f !== RESTORE_VIEW,
    );
    expect(outside, "a file draws a ceremony door or names a ceremony route outside the census").toEqual([]);
  });
});
