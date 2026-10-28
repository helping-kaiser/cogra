"use client";

// SETTINGS — the whole surface, one scrolling page in the ruled order
// (design/designs/canonical/screens/Settings.jsx; `SettingsBody` in
// `_shared.jsx`; behavior/Settings.md). Theme · Giving an opinion · Writing ·
// Reading · People · Key backup · Sessions · Credentials · About · the
// sign-out group · the delete-account group.
//
// THE DELETION ROW KEYS ON THE SERVER'S `deletionPath` (OS-15), never on
// `application.*`: LOCKED wears the locked look and answers with a snackbar
// (Settings.md:157-159); BY_LINK and IMMEDIATE open the request screen; and a
// confirmed deletion in its grace turns the row into its countdown, opening the
// grace page, drops the footnote and brings the band (SettingsDeleting.md).
//
// No bottom bar (the shell hides it off read surfaces), no leading icons, and
// the header pinned — not the collapsing top the inline forms used to ride.
// Credentials are ROWS, each opening its own task page (`/settings/password`,
// `/settings/handle`, `/settings/email…`), and a subpage that lands hands its
// snackbar back through `?done=`.
//
// Every node wears its registered `settings.*` path (`nodes.json`, the
// `Settings` registration), sessions keyed by position, this device first.

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import {
  fetchSettingsAccount,
  revokeOtherSessions,
  revokeSession,
  setAlwaysUnveil,
  setDefaultLicense,
  type SessionView,
  type SettingsAccount,
} from "@/lib/api/settings-api";
import { composeDraftStore, type ComposeDraftStore } from "@/lib/compose/draft-store";
import { LOCKED_ROW, settingsRowStatus } from "@/lib/deletion/deletion-copy";
import { useAccountDeletion } from "@/lib/deletion/deletion-status";
import { sealedDraftStore, type SealedDraftStore } from "@/lib/compose/sealed-draft";
import type { DeviceLockEngine } from "@/lib/identity/device-lock";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useHiddenSet } from "@/lib/hidden/provider";
import { seenRecord } from "@/lib/history/seen-record";
import { forgetSeen } from "@/lib/history/seen-sync";
import { useKeyOnDeviceState } from "@/lib/identity/use-key-on-device";
import { forgetKeptPicks } from "@/lib/stance/kept-picks";
import { licenseName, PUBLIC_DOMAIN, type License } from "@/lib/license";
import { useHostSnack } from "@/lib/saved/save-row";
import { useTokenStore } from "@/lib/session/provider";
import { useAuthGuard, useDeviceLock } from "@/lib/session/runtime";
import { RUNNING_VERSION } from "@/lib/release/running-version";
import { eraseEverything } from "@/lib/settings/erase-everything";
import {
  applyTheme,
  exactValuesPreference,
  themePreference,
  type ThemeChoice,
} from "@/lib/settings/device-preference";
import {
  accountFilterLevel,
  setAccountFilterLevel,
  UNVEIL_LEVEL,
  useAlwaysUnveil,
} from "@/lib/settings/sensitive-content";
import {
  carriedExpectationStore,
  type CarriedExpectationStore,
} from "@/lib/signing/carried";
import { useConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { useStanceInputMode, type StanceInputMode } from "@/lib/stance/input-mode";
import { instance, part, type DataNode } from "@/lib/ui/data-node";
import { PageHeader } from "@/lib/ui/page-header";
import { Snackbar } from "@/lib/ui/snackbar";
import { dateline, ladderAge } from "@/lib/ui/timestamp";
import { TransportError } from "@/lib/ui/transport-error";
import { InlineAction } from "@/lib/ui2/inline-action";
import { SegmentedFilter } from "@/lib/ui2/segmented-filter";
import { SettingsGroup, SettingsRow } from "@/lib/ui2/settings-row";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";

import { EraseConfirm } from "./erase-confirm";
import { SettingsHiddenSheet } from "./settings-hidden-sheet";
import { SettingsLicenseSheet } from "./settings-license-sheet";
import {
  EMAIL_ROUTES,
  emailDestination,
  noticeMessage,
  orderedSessions,
  sessionLabel,
  sessionStatus,
  settingsNoticeOf,
  signOutPath,
} from "./settings-logic";
import { SignOutConfirm } from "./sign-out-confirm";

const NODE: DataNode = { path: "settings" };
const node = (tail: string): DataNode => part(NODE, tail);

/** The contact door's address — a placeholder until CoGra is on a server. */
export const CONTACT_ADDRESS = "hello@cogra.local";


/** The registry's spelling of each stance input's row. */
const STANCE_ROWS: readonly { mode: StanceInputMode; key: string; label: string; status: string }[] = [
  // DRIFT (stance-pad packet): the drawn hint is `A tap opens it; drift to
  // where it feels right.`, which describes the inverted gesture. Until that
  // inversion ships the shipped line stays, because it is the true one
  // (settings-surface §11.3).
  { mode: "pad", key: "pad", label: "The pad", status: "Press and hold, then drift to where you stand." },
  { mode: "sliders", key: "sliders", label: "Sliders", status: "One slider per side of the opinion." },
  { mode: "entry", key: "typed", label: "Typed values", status: "Type both numbers exactly." },
];

/** DRIFT (stance-pad packet): the drawn footnote waits for the inverted gesture. */
const STANCE_FOOTNOTE =
  "A tap always adds a small positive one. This is what a longer press opens, everywhere.";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
] as const;

/**
 * The deletion group's footnote — the mailed path's, and the immediate one's
 * without the link (Settings.md:151, :153). Keyed on the path: BY_LINK is the
 * member's words, IMMEDIATE and LOCKED (both applicants) the applicant's.
 */
const DELETE_FOOTNOTE_MEMBER =
  "Nothing is deleted here. The next screen says what goes and what stays, and the deletion is confirmed by a link we email you.";
const DELETE_FOOTNOTE_APPLICANT = "Nothing is deleted here. The next screen says what goes and what stays.";

/** What a row-level act that got no answer says (copy-voice *Faults by code*). */
const NO_ANSWER = "That didn't send. Try again.";

/** The unveil switch's second line, by state (`_shared.jsx`, #141; the On words ruled in seam 132). */
const UNVEIL_OFF_STATUS = "Off, the veil stays until you tap it.";
const UNVEIL_ON_STATUS = "On, sensitive content stands unveiled wherever you read.";

/**
 * The Clearing data group's footnote, by backup state (Settings.md:139, :141):
 * the key first and the account gone for good, then what else goes, and the
 * seen list's return last — it is a copy of the server's.
 */
const CLEARING_FOOTNOTE_MADE =
  "Your key lives only in this browser. Clear CoGra's data here and the key is erased with it — without your recovery code, your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in.";
const CLEARING_FOOTNOTE_NONE =
  "Your key lives only in this browser, and it has no recovery code yet. Clear CoGra's data here and the key is erased with it — your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in.";

/** A full load of the sign-in, so nothing this tab held in memory outlives the erase. */
function hardNavigate(url: string) {
  window.location.replace(url);
}

export function SettingsView({
  store = identityStore,
  drafts = composeDraftStore,
  seals = sealedDraftStore,
  carried = carriedExpectationStore,
  forgetKept = forgetKeptPicks,
  forgetSeenRecord = (account: string) => forgetSeen(seenRecord, account),
  erase = eraseEverything,
  leave = hardNavigate,
  deviceLock,
}: {
  /** Test injection. */
  store?: IdentityStore;
  drafts?: Pick<ComposeDraftStore, "clear">;
  seals?: Pick<SealedDraftStore, "forget">;
  carried?: Pick<CarriedExpectationStore, "forget">;
  /** Drops one account's kept picks from this browser (`stance/kept-picks.ts`). */
  forgetKept?: (account: string) => Promise<void>;
  /** Drops one account's seen record and watermark from this browser. */
  forgetSeenRecord?: (account: string) => Promise<void>;
  erase?: () => Promise<void>;
  leave?: (url: string) => void;
  deviceLock?: Pick<DeviceLockEngine, "ensureHeld" | "discard">;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const tokens = useTokenStore();
  const clientLock = useDeviceLock();
  const lock = deviceLock ?? clientLock;

  /**
   * The opt-in's lock ends with it (sign-out-custody §3.3: discarded when
   * the switch turns off, the slot is erased, or purged). Best effort, and
   * never in the way of what the reader asked for.
   */
  const discardLock = async () => {
    const account = tokens.activeAccountId();
    if (account === null) return;
    try {
      await lock.discard(account);
    } catch {
      // an orphaned server half opens nothing, and dies with the account
    }
  };
  const router = useRouter();
  const notice = settingsNoticeOf(useSearchParams().get("done"));
  const keyOnDevice = useKeyOnDeviceState(store);
  const deletionStatus = useAccountDeletion();
  const refreshDeletion = deletionStatus.refresh;

  const [account, setAccount] = useState<SettingsAccount | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [forget, setForget] = useState(false);
  // THE PAGE'S ONE SNACKBAR: the page's own confirmations, and the unhide's
  // aftermath with its `Undo` — cleared if the unhide it announced reverts.
  const { snack, notify, dismiss: dismissSnackbar } = useHostSnack();
  const setSnackbar = useCallback(
    (message: string | null) => (message === null ? dismissSnackbar() : notify(message)),
    [dismissSnackbar, notify],
  );
  // HIDDEN ACCOUNTS (SettingsHidden.md): the count, the sheet and its way back.
  const hidden = useHiddenSet();
  const hiddenCount = hidden.count;
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const hiddenRow = useRef<HTMLButtonElement | null>(null);
  const hiddenFailures = hiddenOpen ? [] : [...hidden.failed().values()];
  const hiddenRowFailure = hiddenFailures.find((failure) => failure.kind === "undoUnhide") ?? null;
  const closeHidden = useCallback(() => {
    setHiddenOpen(false);
    queueMicrotask(() => hiddenRow.current?.focus());
  }, []);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [elsewhereBusy, setElsewhereBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  /** A default-license save that did not go through, kept for its Retry. */
  const [licenseFailed, setLicenseFailed] = useState<License | null>(null);

  const [theme, setTheme] = themePreference.use();
  const [exactValues, setExactValues] = exactValuesPreference.use();
  const [stanceMode, setStanceMode] = useStanceInputMode();
  const [confirmMulti, setConfirmMulti] = useConfirmMultiAction();
  const alwaysUnveil = useAlwaysUnveil();

  const sessionRows = useRef(new Map<string, HTMLElement | null>());
  const signOutRow = useRef<HTMLButtonElement | null>(null);
  const eraseRow = useRef<HTMLButtonElement | null>(null);
  const licenseRow = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") {
        setAccount(outcome.value);
        setReadFailed(false);
        // The account's own answer, so a choice made on another device
        // reads here (Settings.md: it follows the account).
        setAccountFilterLevel(outcome.value.preferences?.contentFilteringSeverityLevel ?? null);
      } else {
        setReadFailed(true);
      }
    });
    void store.isEphemeral().then(setForget, () => setForget(false));
  }, [client, guard, store]);

  // The deletion row reads what stands NOW: a link opened in a mail client
  // on another device confirms without this tab hearing of it.
  useEffect(() => {
    void refreshDeletion();
  }, [refreshDeletion]);

  // The subpage's return snackbar, said once — when the fresh read can name
  // it (adjusted during render, React's "adjusting state when a prop
  // changes") — and the `?done=` dropped, so a reload cannot say it again.
  const [noticeSaid, setNoticeSaid] = useState(false);
  if (!noticeSaid && notice !== null && account !== null) {
    setNoticeSaid(true);
    setSnackbar(noticeMessage(notice, account));
  }
  useEffect(() => {
    if (noticeSaid && notice !== null) router.replace("/settings");
  }, [noticeSaid, notice, router]);


  const onTheme = (next: ThemeChoice) => {
    setTheme(next);
    applyTheme(next);
  };

  // ---------------------------------------------------------------- sessions

  const sessions = account === null ? [] : orderedSessions(account.sessions ?? []);

  const onRevoke = async (session: SessionView, index: number) => {
    if (revoking !== null) return;
    setRevoking(session.id);
    const outcome = await guard.run(() => revokeSession(client, session.id));
    setRevoking(null);
    if (outcome.kind !== "success") {
      // The network error answers and the row stays (Settings.md).
      setSnackbar(NO_ANSWER);
      return;
    }
    const remaining = sessions.filter((s) => s.id !== session.id);
    setAccount((current) => (current === null ? current : { ...current, sessions: remaining }));
    setSnackbar(`Signed out of ${sessionLabel(session)}.`);
    // Focus moves to the next row, else the previous.
    const next = remaining[index] ?? remaining[index - 1];
    if (next !== undefined) queueMicrotask(() => sessionRows.current.get(next.id)?.focus());
  };

  const onRevokeElsewhere = async () => {
    if (elsewhereBusy) return;
    setElsewhereBusy(true);
    const outcome = await guard.run(() => revokeOtherSessions(client));
    setElsewhereBusy(false);
    if (outcome.kind !== "success") {
      setSnackbar(NO_ANSWER);
      return;
    }
    setAccount((current) =>
      current === null
        ? current
        : { ...current, sessions: (current.sessions ?? []).filter((s) => s.isCurrent) },
    );
    setSnackbar("Signed out everywhere else.");
  };

  // --------------------------------------------------------- default license

  const currentLicense: License = account?.preferences?.defaultLicense ?? PUBLIC_DOMAIN;

  const saveLicense = async (license: License) => {
    if (account === null) return;
    const before = account;
    // A read-side comfort, saved optimistically (seam 044 K4.1): the row reads
    // the new default at once, and a failure reverts it and says so.
    setAccount({
      ...account,
      preferences: {
        contentFilteringSeverityLevel: account.preferences?.contentFilteringSeverityLevel ?? null,
        defaultLicense: { ...license },
      },
    });
    setLicenseFailed(null);
    const outcome = await guard.run(() => setDefaultLicense(client, license));
    if (outcome.kind !== "success") {
      setAccount(before);
      setLicenseFailed(license);
    }
  };

  // ------------------------------------------------------- sensitive content

  /** Only the latest flip's failure may put the switch back. */
  const unveilSave = useRef(0);

  const onUnveil = async () => {
    const before = accountFilterLevel();
    const on = !alwaysUnveil;
    // Saved optimistically (R8; seam 044 K4.1): the switch flips at once,
    // every veil in this tab answers it, and no dialog asks.
    setAccountFilterLevel(on ? UNVEIL_LEVEL : null);
    const save = ++unveilSave.current;
    const outcome = await guard.run(() => setAlwaysUnveil(client, on));
    if (save !== unveilSave.current) return;
    if (outcome.kind === "success") {
      setAccountFilterLevel(outcome.value);
      return;
    }
    // Both values are valid, so the only failure is no answer: the switch
    // goes back and the shared no-answer line says so (digest item 95).
    setAccountFilterLevel(before);
    setSnackbar(NO_ANSWER);
  };

  // ---------------------------------------------------------------- sign out

  /**
   * The whole custody set of this account on this browser: the key and its
   * material (one IndexedDB transaction, `purgeIfEphemeral`), then the draft.
   * Both run while the account is still active, and neither ever blocks the
   * exit. The kept picks go with the draft (Settings.md:159).
   */
  const purgeCustody = async () => {
    // Named before the key goes: the record to drop is this account's, read
    // while it is still the active one.
    const accountId = tokens.activeAccountId();
    try {
      await store.purgeIfEphemeral();
    } catch {
      // sign-out proceeds regardless
    }
    try {
      await drafts.clear();
    } catch {
      // sign-out proceeds regardless
    }
    // A post's sealed copy is the draft it was written from, held until the
    // write lands or expires — so it goes with the draft (Settings.md:145).
    try {
      await seals.forget();
    } catch {
      // sign-out proceeds regardless
    }
    // A carried write's prepare-time expectation is the draft's tier, and goes
    // with it (signing/carried.ts).
    try {
      await carried.forget();
    } catch {
      // sign-out proceeds regardless
    }
    // The picks kept pending are the draft's tier too (`stance/kept-picks.ts`).
    if (accountId !== null) {
      try {
        await forgetKept(accountId);
      } catch {
        // sign-out proceeds regardless
      }
    }
    // What this account has seen on this browser — the ids and the sync
    // watermark — is dropped with it and no other account's; the server's
    // view log survives and a later sign-in re-seeds from it.
    if (accountId !== null) {
      try {
        await forgetSeenRecord(accountId);
      } catch {
        // sign-out proceeds regardless
      }
    }
  };

  const endSession = async (purge: boolean) => {
    setSigningOut(true);
    // Best-effort self-revocation: an unreachable server never blocks signing
    // out (auth.md "Sign-out").
    if (purge) await discardLock();
    await guard.run(() => revokeSession(client, null));
    if (purge) await purgeCustody();
    // Clearing the tokens flips the phase; the (app) gate replaces the
    // location with sign-in.
    tokens.clear();
  };

  const onSignOut = async () => {
    if (signingOut) return;
    const keyHere = keyOnDevice === "present";
    // A backup is positively known from the account's own read; without the
    // read, an absent retained seed still proves the upload happened
    // (`store.ts`), and anything else is unknown — which asks.
    let backed = account !== null ? account.keyBackupCreatedAt != null : false;
    if (account === null && keyHere) {
      backed = await store.actorSeed().then((seed) => seed === null, () => false);
    }
    const path = signOutPath({ forget, keyHere, backed });
    if (path === "ask") {
      setConfirmOpen(true);
      return;
    }
    await endSession(path === "purge");
  };

  const onForget = async () => {
    const next = !forget;
    setForget(next);
    try {
      await store.setEphemeral(next);
    } catch {
      setForget(!next);
      return;
    }
    // The switch flips with no dialog and never waits on the network
    // (Settings.md:119): the lock follows behind, best effort — obtained
    // when on (retried at the next start if it did not arrive), discarded
    // when off (sign-out-custody §3.4).
    const account = tokens.activeAccountId();
    if (account === null) return;
    try {
      if (next) await lock.ensureHeld(account);
      else await lock.discard(account);
    } catch {
      // the next start retries the hold; a stale server half opens nothing
    }
  };

  /**
   * The dialog's erase (EraseConfirm.md:21): this browser's key, draft, kept
   * picks, the choices kept here and the seen list's copy go for good, the
   * session ends, and the sign-in opens with no account offered — no
   * snackbar. The session is revoked first, best effort, while a token still
   * exists to name it.
   */
  const onEraseEverything = async () => {
    setEraseOpen(false);
    setSigningOut(true);
    // The erase gains one step (sign-out-custody §3.5 ERASE): the lock's
    // server half is discarded while a session still exists to name it.
    await discardLock();
    await guard.run(() => revokeSession(client, null));
    try {
      await erase();
    } catch {
      // the session ends regardless
    }
    tokens.clear();
    leave("/login");
  };

  const signOutSlow = useSlowAnswer(signingOut);

  // ---------------------------------------------------------------- the page

  const beforeCeremony = account !== null && account.actorPubkey == null;
  const backupMade = account?.keyBackupCreatedAt != null;
  const pending = account?.pendingEmailChange ?? null;
  const deletionPath = deletionStatus.standing?.path ?? null;
  const grace = deletionStatus.standing?.deletion ?? null;

  const onDeleteRow = () => {
    if (grace !== null) router.push("/settings/delete/pending");
    else if (deletionPath === "LOCKED") setSnackbar(LOCKED_ROW);
    else if (deletionPath !== null) router.push("/settings/delete");
  };

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      <div className="sticky top-0 z-10 bg-surface">
        <PageHeader
          title="Settings"
          backHref="/profile"
          backLabel="Back to your profile"
          node={node("header")}
          deletionBand={node("deletionBand")}
        />
      </div>
      <div className="flex flex-col gap-6 px-6 pb-8 pt-6">
        {readFailed && account === null && <TransportError testId="settings-read-failed" />}

        <SettingsGroup
          bare
          label="Theme"
          footnote="Auto follows your device's own setting, and the choice stays on this device."
          node={node("theme")}
        >
          <div>
            <SegmentedFilter
              block
              ariaLabel="Theme"
              value={theme}
              options={THEME_OPTIONS}
              onChange={onTheme}
              node={node("theme.picker")}
            />
          </div>
        </SettingsGroup>

        <SettingsGroup label="Giving an opinion" footnote={STANCE_FOOTNOTE} node={node("stance")}>
          {STANCE_ROWS.map((row) => (
            <SettingsRow
              key={row.mode}
              name="settings-stance-input"
              selected={stanceMode === row.mode}
              label={row.label}
              status={row.status}
              onOpen={() => setStanceMode(row.mode)}
              node={node(`stance.${row.key}`)}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup
          label="Writing"
          footnote="Every signed action is paid for separately. A post's license is settled when it is first signed and never changes."
          node={node("writing")}
        >
          <SettingsRow
            checked={confirmMulti}
            label="Confirm multi-action submits"
            status="Ask first when one submit signs more than one action."
            onOpen={() => setConfirmMulti(!confirmMulti)}
            node={node("writing.confirm")}
          />
          {licenseFailed === null ? (
            <SettingsRow
              label="Default license"
              value={account === null ? undefined : licenseName(currentLicense)}
              onOpen={() => setLicenseOpen(true)}
              rowRef={licenseRow}
              node={node("writing.license")}
            />
          ) : (
            <SettingsRow
              label="Default license"
              status="That didn't go through."
              statusTone="error"
              value={licenseName(currentLicense)}
              inert
              trailing={
                <InlineAction onClick={() => void saveLicense(licenseFailed)} testId="settings-license-retry">
                  Retry
                </InlineAction>
              }
              node={node("writing.license")}
            />
          )}
        </SettingsGroup>

        <SettingsGroup
          label="Reading"
          footnote="Every feed starts from what it shows, and a change made inside a feed lasts until you change it back. Both choices stay on this device."
          node={node("reading")}
        >
          {/* DRIFT (feed-filter packet): the sheet this row opens
              (SettingsReading) waits for the feed filter that owns the
              reader's default. Every feed shows posts today, so the row reads
              true; the tap opens nothing until the filter exists. */}
          <SettingsRow label="What your feed shows" value="Posts" onOpen={() => {}} node={node("reading.feed")} />
          <SettingsRow
            checked={exactValues === "on"}
            label="Show exact values"
            status="The number pairs behind the faces."
            onOpen={() => setExactValues(exactValues === "on" ? "off" : "on")}
            node={node("reading.exact")}
          />
        </SettingsGroup>

        <SettingsGroup
          label="People"
          footnote="Hiding someone clears your own feed of them. Nothing changes for them, and their profile still opens if you go looking."
          node={node("people")}
        >
          {/* THE COUNT IS THE HIDDEN SET'S (hidden-actors §5.1). With nobody
              hidden the row is inert and reads `None` — a tap that could only
              open an empty sheet is a tap spent on nothing (Settings.md). An
              Undo of an unhide that did not go through after the sheet closed
              is said here, with Retry (SettingsHidden.md:33). */}
          {hiddenRowFailure === null ? (
            <SettingsRow
              label="Hidden accounts"
              value={hiddenCount === 0 ? "None" : String(hiddenCount)}
              inert={hiddenCount === 0}
              onOpen={hiddenCount === 0 ? undefined : () => setHiddenOpen(true)}
              rowRef={hiddenRow}
              node={node("people.hidden")}
            />
          ) : (
            <SettingsRow
              label="Hidden accounts"
              status="That didn't go through."
              statusTone="error"
              value={hiddenCount === 0 ? "None" : String(hiddenCount)}
              inert
              trailing={
                <InlineAction onClick={hiddenRowFailure.retry} testId="settings-hidden-retry">
                  Retry
                </InlineAction>
              }
              rowRef={hiddenRow}
              node={node("people.hidden")}
            />
          )}
        </SettingsGroup>

        {/* THE VEIL IS THE ACCOUNT'S CHOICE, NOT THIS DEVICE'S (#141): its own
            group, because Reading's footnote promises "this device" and this
            does not. One switch, off by default, never a sheet. */}
        <SettingsGroup
          label="Sensitive content"
          footnote="This choice follows your account to every device."
          node={node("sensitive")}
        >
          <SettingsRow
            checked={alwaysUnveil}
            label="Always unveil sensitive content"
            status={alwaysUnveil ? UNVEIL_ON_STATUS : UNVEIL_OFF_STATUS}
            onOpen={() => void onUnveil()}
            node={node("sensitive.unveil")}
          />
        </SettingsGroup>

        <SettingsGroup
          label="Key backup"
          footnote={
            backupMade
              ? "Your key signs everything you publish and lives only in this browser. Your recovery code is the only way back."
              : "Your key signs everything you publish and lives only in this browser. Until you make a recovery code, it can't be brought back."
          }
          node={node("backup")}
        >
          <SettingsRow
            label="Recovery code"
            status={
              account === null
                ? undefined
                : backupMade && !beforeCeremony
                  ? `Last created ${dateline(account.keyBackupCreatedAt as string)}`
                  : "Not made yet"
            }
            onOpen={() => router.push(beforeCeremony ? "/key" : "/settings/backup")}
            node={node("backup.recovery")}
          />
          <SettingsRow
            label="Your key"
            status={beforeCeremony ? "Not made yet" : undefined}
            onOpen={() => router.push(beforeCeremony ? "/key" : "/settings/key")}
            node={node("backup.key")}
          />
        </SettingsGroup>

        {/* After Key backup, because the loss it warns of is the key's
            (Settings.md:139-145). An unread backup state takes the no-code
            words: the stronger warning is the safe one. The row is quiet like
            Sign out — the weight lives in the dialog it raises. */}
        <SettingsGroup
          label="Clearing data"
          footnote={backupMade ? CLEARING_FOOTNOTE_MADE : CLEARING_FOOTNOTE_NONE}
          node={node("clearing")}
        >
          <SettingsRow
            action
            label="Erase everything from this browser"
            onOpen={() => setEraseOpen(true)}
            rowRef={eraseRow}
            node={node("clearing.erase")}
          />
        </SettingsGroup>

        <SettingsGroup
          label="Sessions"
          footnote="A device you sign out can stay signed in for up to 15 minutes."
          node={node("sessions")}
        >
          {sessions.map((session, index) => (
            <SessionRow
              key={session.id}
              session={session}
              position={index + 1}
              revoking={revoking === session.id}
              onRevoke={() => void onRevoke(session, index)}
              rowRef={(element) => {
                sessionRows.current.set(session.id, element);
              }}
            />
          ))}
          <SettingsRow
            action
            label="Sign out everywhere else"
            busy={elsewhereBusy}
            onOpen={() => void onRevokeElsewhere()}
            node={node("sessions.elsewhere")}
          />
        </SettingsGroup>

        <SettingsGroup
          label="Credentials"
          footnote="Changing your password signs out every other device."
          node={node("credentials")}
        >
          <SettingsRow
            label="Password"
            status={
              account?.passwordChangedAt == null
                ? undefined
                : `Changed ${ladderAge(account.passwordChangedAt)}`
            }
            onOpen={() => router.push("/settings/password")}
            node={node("credentials.password")}
          />
          <SettingsRow
            label="Handle"
            value={account === null ? undefined : `@${account.handle}`}
            onOpen={() => router.push("/settings/handle")}
            node={node("credentials.handle")}
          />
          <SettingsRow
            label="Email"
            value={account?.email ?? undefined}
            status={pending !== null ? "Change pending" : undefined}
            onOpen={() => {
              if (account !== null) router.push(EMAIL_ROUTES[emailDestination(account)]);
            }}
            node={node("credentials.email")}
          />
        </SettingsGroup>

        <SettingsGroup label="About" node={node("about")}>
          {/* DRIFT (the intro, Report a problem packets; Privacy and Terms
              await their documents): rows whose destination is not built yet
              open nothing. */}
          <SettingsRow label="Watch the intro again" onOpen={() => {}} node={node("about.intro")} />
          <SettingsRow
            label="About CoGra"
            onOpen={() => router.push("/about?from=settings")}
            node={node("about.aboutCogra")}
          />
          <SettingsRow
            label="What's new"
            value={RUNNING_VERSION}
            onOpen={() => router.push("/settings/whats-new")}
            node={node("about.whatsNew")}
          />
          <SettingsRow label="Report a problem" onOpen={() => {}} node={node("about.report")} />
          <SettingsRow
            label="Contact"
            value={CONTACT_ADDRESS}
            onOpen={() => {
              window.location.href = `mailto:${CONTACT_ADDRESS}`;
            }}
            node={node("about.contact")}
          />
          <SettingsRow label="Privacy" onOpen={() => {}} node={node("about.privacy")} />
          <SettingsRow label="Terms" onOpen={() => {}} node={node("about.terms")} />
        </SettingsGroup>

        <SettingsGroup ariaLabel="Sign out" node={node("leaving")}>
          <SettingsRow
            checked={forget}
            label="Don't remember this account on this device"
            status="Your key, your draft, any kept picks and what you've seen are cleared from this browser when you sign out."
            onOpen={() => void onForget()}
            node={node("leaving.forget")}
          />
          <SettingsRow
            action
            label={signOutSlow ? "Signing out…" : "Sign out"}
            busy={signingOut}
            onOpen={() => void onSignOut()}
            rowRef={signOutRow}
            node={node("leaving.leave")}
          />
        </SettingsGroup>

        {/* The page's last row, in a group of its own after leaving, drawn
            quiet: a navigating row with a chevron. During a confirmed
            deletion's grace it reads the countdown and the footnote goes —
            the footnote describes a request not yet made
            (SettingsDeleting.md:5-9). */}
        <SettingsGroup
          ariaLabel="Delete account"
          footnote={
            grace !== null
              ? undefined
              : deletionPath === "IMMEDIATE" || deletionPath === "LOCKED"
                ? DELETE_FOOTNOTE_APPLICANT
                : DELETE_FOOTNOTE_MEMBER
          }
          node={node("ending")}
        >
          <SettingsRow
            label="Delete account"
            status={grace === null ? undefined : settingsRowStatus(grace, deletionStatus.now)}
            locked={grace === null && deletionPath === "LOCKED"}
            onOpen={onDeleteRow}
            node={node("ending.delete")}
          />
        </SettingsGroup>
      </div>

      {licenseOpen && (
        <SettingsLicenseSheet
          license={currentLicense}
          onDone={(license) => {
            setLicenseOpen(false);
            licenseRow.current?.focus();
            void saveLicense(license);
          }}
          onDiscard={() => {
            setLicenseOpen(false);
            licenseRow.current?.focus();
          }}
        />
      )}

      {confirmOpen && (
        <SignOutConfirm
          onMakeCode={() => {
            setConfirmOpen(false);
            router.push("/settings/backup");
          }}
          onErase={() => {
            setConfirmOpen(false);
            void endSession(true);
          }}
          onDismiss={() => {
            setConfirmOpen(false);
            signOutRow.current?.focus();
          }}
        />
      )}

      {eraseOpen && (
        <EraseConfirm
          backupMade={backupMade}
          onMakeCode={() => {
            setEraseOpen(false);
            router.push("/settings/backup");
          }}
          onErase={() => void onEraseEverything()}
          onDismiss={() => {
            setEraseOpen(false);
            eraseRow.current?.focus();
          }}
        />
      )}

      <SettingsHiddenSheet open={hiddenOpen} set={hidden} notify={notify} onClose={closeHidden} />
      <Snackbar
        testId="settings-snackbar"
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismissSnackbar}
      />
    </main>
  );
}

function SessionRow({
  session,
  position,
  revoking,
  onRevoke,
  rowRef,
}: {
  session: SessionView;
  position: number;
  revoking: boolean;
  onRevoke: () => void;
  rowRef: (element: HTMLElement | null) => void;
}) {
  const slow = useSlowAnswer(revoking);
  const row = instance(NODE, "sessions.session", String(position));
  return (
    <SettingsRow
      label={sessionLabel(session)}
      status={sessionStatus(session)}
      inert
      rowRef={rowRef}
      trailing={
        session.isCurrent ? undefined : (
          <InlineAction
            onClick={onRevoke}
            busy={revoking}
            busyLabel={slow ? "Revoking…" : "Revoke"}
            node={part(row, "revoke")}
          >
            Revoke
          </InlineAction>
        )
      }
      node={row}
    />
  );
}
