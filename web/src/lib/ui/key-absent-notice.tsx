"use client";

// THE PAD'S KEY NOTICE (PadKeyAbsent.md, KeyElsewhereNoBackup.md) — what
// stands where the landing line and the actions would when the signing key is
// not on this device: `NoticePanel` in the tertiary container, never the error
// colour, with its own "?" opening the Your key text, then `Keep it pending,
// restore later` under it. No Set, no Cancel, no Walk it back.
//
// WITH NO BACKUP there is nothing to restore from yet: the notice drops
// `Restore the key` and its restore line reads the no-backup sentence
// instead, and `Keep it pending, restore later` stays — a pick kept here can
// still be signed the day the key arrives.
//
// ONE DRAWING FOR BOTH OF THE CONTROL'S CONSIDERED SURFACES: the pad, and the
// alternates that replace it everywhere for a reader whose input is sliders or
// typed values (§8.6) — the alternates have no board of their own for this
// state, so they carry the pad's notice as drawn.

import Link from "next/link";

import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { pillClassName } from "@/lib/ui2/pill-button";
import { buttonClassName } from "./button";

export const KEY_ABSENT_TITLE = "Your key isn't on this browser";
export const KEY_ABSENT_PAD_LINE =
  "Signing needs your key, which isn't in this browser — the write waits as pending.";
export const KEY_ABSENT_RESTORE_LINE = "Restore the key with your recovery code to finish.";
/** The no-backup sentence, the same on every key-absent notice (KeyElsewhereNoBackup.md:7). */
export const NO_BACKUP_LINE =
  "This account has no backup, so the key can't be brought here yet. Make a recovery code on the device that holds it, then restore it here. Until then, anything you sign waits as pending.";
export const KEEP_PENDING = "Keep it pending, restore later";

export function KeyAbsentNotice({
  testIdPrefix,
  backedUp,
  onHelp,
  onKeep,
}: {
  testIdPrefix: string;
  /** False only when the account is known to have no backup. */
  backedUp: boolean | null;
  onHelp: () => void;
  onKeep: () => void;
}) {
  const noBackup = backedUp === false;
  return (
    <>
      <NoticePanel
        title={KEY_ABSENT_TITLE}
        help={{ label: "Your key", onOpen: onHelp, testId: `${testIdPrefix}-key-help` }}
        testId={`${testIdPrefix}-key-absent`}
      >
        <NoticeLine>{KEY_ABSENT_PAD_LINE}</NoticeLine>
        <NoticeLine>{noBackup ? NO_BACKUP_LINE : KEY_ABSENT_RESTORE_LINE}</NoticeLine>
        {!noBackup && (
          <Link
            href="/restore"
            data-testid={`${testIdPrefix}-restore`}
            className={pillClassName({ variant: "inverse", full: true })}
          >
            Restore the key
          </Link>
        )}
      </NoticePanel>
      <button
        type="button"
        data-testid={`${testIdPrefix}-keep-pending`}
        onClick={onKeep}
        className={`w-full ${buttonClassName({ variant: "text" })}`}
      >
        {KEEP_PENDING}
      </button>
    </>
  );
}
