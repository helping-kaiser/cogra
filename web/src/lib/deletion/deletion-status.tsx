"use client";

// THE ACCOUNT'S DELETION, READ ONCE FOR EVERY SURFACE (FeedDeleting.md:3: the
// band "rides every logged-in surface"; SettingsDeleting.md; the erasure
// packet's slice C1). Mounted in the root layout, it holds the server's two
// answers about the viewer's own deletion — `deletionPath` (OS-15: which verb
// answers, or LOCKED) and `accountDeletion` (the confirmed grace) — so the
// band under every header, the settings row and the deletion's own screens
// read one standing and a cancel on any of them clears all of them at once.
//
// THE CLIENT NEVER DERIVES THE PATH. It is read, never computed from
// `application.*`: a lapsed vouch clears `approvedAt` while the funding
// stays, so a client-side reading would unlock a row the server refuses.
//
// A confirmation from another device's mail client shows up on the next
// read: on sign-in, whenever the page comes back on screen, and whenever a
// surface asks (`refresh`). The count re-reads the clock every minute so the
// last day's hours keep falling.
//
// THE APPLICANT'S IMMEDIATE DELETION ENDS THE SESSION HERE. The account is
// gone, so its tokens go, and the reader lands signed out on the bare view
// with one snackbar (DeleteAccount.md:29) — not on the sign-in screen the
// member gate would send a signed-out reader to, which is why the gate asks
// `leaving` first.
//
// THE DEADLINE, MET WITH A SESSION ON THIS DEVICE (FeedDeleting.md:23; ER-G6)
// lands the same way: signed out on the bare view under `Your account is
// deleted.`, never on the sign-in screen. The execution ends every session,
// so a session that ends once the standing deadline has passed is read as
// the deletion having run; at the deadline itself the standing is re-read, so
// the server's answer — the refused session — is what moves the reader. This
// is the client half alone: the refusal does not yet name its cause (the
// contract half rides B2), so a session that ends on this device after the
// deadline for any other reason lands here too.

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client/react";

import {
  cancelAccountDeletion,
  fetchDeletionStanding,
  type AccountDeletion,
  type DeletionStanding,
} from "@/lib/api/deletion-api";
import { unauthenticated, type Outcome } from "@/lib/api/outcome";
import { useActiveAccountId, useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import type { DataNode } from "@/lib/ui/data-node";
import { DeletionBand } from "@/lib/ui/deletion-band";
import { Snackbar } from "@/lib/ui/snackbar";

import { bandLine, CANCELED, DELETED, NO_ANSWER } from "./deletion-copy";

/** How often the count re-reads the clock. */
const TICK_MS = 60_000;

/** The longest delay a browser timer holds (2^31 - 1 ms); a later deadline re-arms on the next read. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** Where the reader lands once their applicant account is deleted (DeleteAccount.md:29). */
export const BARE_VIEW = "/feed";

export type AccountDeletionStatus = {
  /** The server's answer for the signed-in account; null until it has answered. */
  readonly standing: DeletionStanding | null;
  /** The clock the counts read, ticking while a deletion stands. */
  readonly now: number;
  /** Re-reads the standing from the server. */
  refresh(): Promise<Outcome<DeletionStanding>>;
  /** Takes a deletion a mutation answered, without another read. */
  setDeletion(deletion: AccountDeletion | null): void;
  /** Calls the deletion off; on success the band and the row clear everywhere. */
  cancel(): Promise<Outcome<true>>;
  /** Says one line in the shell's snackbar, over whatever surface stands. */
  announce(message: string): void;
  /** The applicant's account is gone: end the session and land on the bare view. */
  leaveDeleted(): void;
  /** True from `leaveDeleted` until the bare view is reached. */
  readonly leaving: boolean;
};

const StatusContext = createContext<AccountDeletionStatus | null>(null);

type Read = { account: string | null; standing: DeletionStanding };

export function AccountDeletionProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const account = useActiveAccountId();
  const tokens = useTokenStore();
  const router = useRouter();
  const pathname = usePathname();

  const [read, setRead] = useState<Read | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** The latest write wins: a read that left before a mutation answered must not undo it. */
  const generation = useRef(0);

  // Another account's answer is never this one's: the standing is keyed by
  // the account it was read for, and reads null for anyone else.
  const standing = phase === "signedIn" && read !== null && read.account === account ? read.standing : null;

  const refresh = useCallback(async (): Promise<Outcome<DeletionStanding>> => {
    // A signed-out reader has no account to ask about (a mail link opened
    // without a session); nothing goes out.
    if (phase !== "signedIn") return unauthenticated();
    const asked = ++generation.current;
    const reading = account;
    const outcome = await guard.run(() => fetchDeletionStanding(client));
    if (outcome.kind === "success" && asked === generation.current) {
      setRead({ account: reading, standing: outcome.value });
      setNow(Date.now());
    }
    return outcome;
  }, [phase, account, client, guard]);

  useEffect(() => {
    if (phase !== "signedIn") return;
    void refresh();
    const onVisible = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, refresh]);

  const standingDeletion = standing?.deletion ?? null;
  useEffect(() => {
    if (standingDeletion === null) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [standingDeletion]);

  // The clock also reads at the deadline itself, so the deadline is met on
  // time rather than up to a tick late.
  const deadline = standingDeletion === null ? null : Date.parse(standingDeletion.scheduledFor);
  useEffect(() => {
    if (deadline === null) return;
    const wait = deadline - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(wait, MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [deadline]);

  // Due: the server says whether it ran. A session it ended is refused, the
  // guard's refresh fails, and the phase turns signed-out below.
  const due = deadline !== null && now >= deadline;
  useEffect(() => {
    if (due) void refresh();
  }, [due, refresh]);

  // The deadline last seen while signed in, adjusted during render (React's
  // "adjusting state when a prop changes") so the landing is decided in the
  // same render the session ends in — before the member gate's effect could
  // send the reader to the sign-in screen.
  const [seenDeadline, setSeenDeadline] = useState<number | null>(null);
  if (phase === "signedIn" && seenDeadline !== deadline) setSeenDeadline(deadline);
  if (phase === "signedOut" && seenDeadline !== null) {
    setSeenDeadline(null);
    if (now >= seenDeadline) {
      setLeaving(true);
      setMessage(DELETED);
    }
  }

  const setDeletion = useCallback(
    (deletion: AccountDeletion | null) => {
      generation.current += 1;
      setRead((current) =>
        current === null || current.account !== account
          ? current
          : { account, standing: { ...current.standing, deletion } },
      );
      setNow(Date.now());
    },
    [account],
  );

  const cancel = useCallback(async () => {
    const outcome = await guard.run(() => cancelAccountDeletion(client));
    if (outcome.kind === "success") setDeletion(null);
    return outcome;
  }, [client, guard, setDeletion]);

  const announce = useCallback((line: string) => setMessage(line), []);
  const dismiss = useCallback(() => setMessage(null), []);

  const leaveDeleted = useCallback(() => {
    setLeaving(true);
    setMessage(DELETED);
    tokens.clear();
  }, [tokens]);

  // Signed out by the deletion, the reader goes to the bare view; once there,
  // the gate may answer a later sign-out the ordinary way again (adjusted
  // during render, React's "adjusting state when a prop changes").
  if (leaving && phase === "signedOut" && pathname === BARE_VIEW) setLeaving(false);
  useEffect(() => {
    if (leaving && phase === "signedOut") router.replace(BARE_VIEW);
  }, [leaving, phase, router]);

  const value = useMemo<AccountDeletionStatus>(
    () => ({ standing, now, refresh, setDeletion, cancel, announce, leaveDeleted, leaving }),
    [standing, now, refresh, setDeletion, cancel, announce, leaveDeleted, leaving],
  );

  return (
    <StatusContext.Provider value={value}>
      {children}
      <Snackbar testId="deletion-snackbar" message={message} onDismiss={dismiss} />
    </StatusContext.Provider>
  );
}

/** The deletion's standing, for a surface that is the deletion's own. */
export function useAccountDeletion(): AccountDeletionStatus {
  const status = useContext(StatusContext);
  if (status === null) throw new Error("useAccountDeletion requires an AccountDeletionProvider");
  return status;
}

/** Whether the reader is on their way out after deleting their applicant account. */
export function useLeavingDeleted(): boolean {
  return useContext(StatusContext)?.leaving ?? false;
}

/**
 * THE ONE BAND ARBITRATION (ER-G4; FeedDeleting.md:13, FeedDeleting.jsx:16-18,
 * jakob 2026-10-07): the deletion band stands exactly while a confirmed
 * deletion runs its grace, and while it stands the borrowed view's band does
 * not — it carries an act and a deadline, and the borrowed band asks for
 * nothing. Both bands read this one answer, so no surface arbitrates on its own.
 */
export function useDeletionBandStands(): boolean {
  return useBandDeletion() !== null;
}

/** The deletion the band stands on, or null where no band stands. */
function useBandDeletion(): AccountDeletion | null {
  return useContext(StatusContext)?.standing?.deletion ?? null;
}

/**
 * THE BAND'S SLOT, under every header (`PageHeader` on an inner surface,
 * `CograBand`'s children on a root): it stands exactly while a confirmed
 * deletion runs its grace, and its Cancel answers with the canceled snackbar,
 * no Undo, no dialog (FeedDeleting.md:19) — or, with no answer, the network
 * error, and the band stays (`:21`; SettingsDeleting.md:17).
 *
 * `bleed` is for a header whose host pads by the screen gutter: the band is
 * full-width under the header, never inset like a card (FeedDeleting.md:5).
 */
export function DeletionBandSlot({ node, bleed = false }: { node?: DataNode; bleed?: boolean }) {
  const status = useContext(StatusContext);
  const deletion = useBandDeletion();
  const [busy, setBusy] = useState(false);
  if (status === null || deletion === null) return null;

  const onCancel = async () => {
    if (busy) return;
    setBusy(true);
    const outcome = await status.cancel();
    setBusy(false);
    status.announce(outcome.kind === "success" ? CANCELED : NO_ANSWER);
  };

  return (
    <DeletionBand
      line={bandLine(deletion, status.now)}
      busy={busy}
      onCancel={() => void onCancel()}
      node={node}
      className={bleed ? "-mx-6" : undefined}
    />
  );
}
