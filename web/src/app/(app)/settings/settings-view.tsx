"use client";

// SETTINGS — the whole surface, one scrolling page in the ruled order
// (design/designs/canonical/screens/Settings.jsx; `SettingsBody` in
// `_shared.jsx`; behavior/Settings.md). Theme · Giving an opinion · Writing ·
// Reading · People · Key backup · Sessions · Credentials · About · the
// sign-out group. The delete-account group is the erasure packet's, and its
// slot stays at the end of the page.
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
  setDefaultLicense,
  type SessionView,
  type SettingsAccount,
} from "@/lib/api/settings-api";
import { composeDraftStore, type ComposeDraftStore } from "@/lib/compose/draft-store";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDeviceState } from "@/lib/identity/use-key-on-device";
import { licenseName, PUBLIC_DOMAIN, type License } from "@/lib/license";
import { useTokenStore } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import {
  applyTheme,
  exactValuesPreference,
  themePreference,
  type ThemeChoice,
} from "@/lib/settings/device-preference";
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

/** The version running here — `web/package.json`, which the build reads. */
export const RUNNING_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

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

/** What a row-level act that got no answer says (copy-voice *Faults by code*). */
const NO_ANSWER = "That didn't send. Try again.";

export function SettingsView({
  store = identityStore,
  drafts = composeDraftStore,
}: {
  /** Test injection. */
  store?: IdentityStore;
  drafts?: Pick<ComposeDraftStore, "clear">;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const tokens = useTokenStore();
  const router = useRouter();
  const notice = settingsNoticeOf(useSearchParams().get("done"));
  const keyOnDevice = useKeyOnDeviceState(store);

  const [account, setAccount] = useState<SettingsAccount | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [forget, setForget] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [elsewhereBusy, setElsewhereBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  /** A default-license save that did not go through, kept for its Retry. */
  const [licenseFailed, setLicenseFailed] = useState<License | null>(null);

  const [theme, setTheme] = themePreference.use();
  const [exactValues, setExactValues] = exactValuesPreference.use();
  const [stanceMode, setStanceMode] = useStanceInputMode();
  const [confirmMulti, setConfirmMulti] = useConfirmMultiAction();

  const sessionRows = useRef(new Map<string, HTMLElement | null>());
  const signOutRow = useRef<HTMLButtonElement | null>(null);
  const licenseRow = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") {
        setAccount(outcome.value);
        setReadFailed(false);
      } else {
        setReadFailed(true);
      }
    });
    void store.isEphemeral().then(setForget, () => setForget(false));
  }, [client, guard, store]);

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

  const dismissSnackbar = useCallback(() => setSnackbar(null), []);

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
      preferences: { ...account.preferences, defaultLicense: { ...license } },
    });
    setLicenseFailed(null);
    const outcome = await guard.run(() => setDefaultLicense(client, license));
    if (outcome.kind !== "success") {
      setAccount(before);
      setLicenseFailed(license);
    }
  };

  // ---------------------------------------------------------------- sign out

  /**
   * The whole custody set of this account on this browser: the key and its
   * material (one IndexedDB transaction, `purgeIfEphemeral`), then the draft.
   * Both run while the account is still active, and neither ever blocks the
   * exit. Kept picks join the set when they exist (sign-out-custody §3.2).
   */
  const purgeCustody = async () => {
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
  };

  const endSession = async (purge: boolean) => {
    setSigningOut(true);
    // Best-effort self-revocation: an unreachable server never blocks signing
    // out (auth.md "Sign-out").
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
    }
  };

  const signOutSlow = useSlowAnswer(signingOut);

  // ---------------------------------------------------------------- the page

  const beforeCeremony = account !== null && account.actorPubkey == null;
  const backupMade = account?.keyBackupCreatedAt != null;
  const pending = account?.pendingEmailChange ?? null;

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      <div className="sticky top-0 z-10 bg-surface">
        <PageHeader
          title="Settings"
          backHref="/profile"
          backLabel="Back to your profile"
          node={node("header")}
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
          {/* Nobody can be hidden yet (the Hide packet), so the row is the
              drawn empty state: inert, `None`. */}
          <SettingsRow label="Hidden accounts" value="None" inert node={node("people.hidden")} />
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
          {/* DRIFT (the intro, What's new, Report a problem packets; Privacy
              and Terms await their documents): rows whose destination is not
              built yet open nothing. */}
          <SettingsRow label="Watch the intro again" onOpen={() => {}} node={node("about.intro")} />
          <SettingsRow
            label="About CoGra"
            onOpen={() => router.push("/about?from=settings")}
            node={node("about.aboutCogra")}
          />
          <SettingsRow label="What's new" value={RUNNING_VERSION} onOpen={() => {}} node={node("about.whatsNew")} />
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
            status="Your key, your draft and any kept picks are cleared from this browser when you sign out."
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

      <Snackbar testId="settings-snackbar" message={snackbar} onDismiss={dismissSnackbar} />
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
