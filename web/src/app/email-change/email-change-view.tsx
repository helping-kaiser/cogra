"use client";

// THE NEW ADDRESS'S LINK, OPENED (design/designs/canonical/screens/
// ChangeEmailLinked.jsx and ChangeEmailLinkedSignedOut.jsx; their sidecars;
// copy-voice *The new address's link, opened*). The link the change mails to
// the new address is `/email-change?token=…` (auth.md "Link URLs"); this
// landing answers it signed in and signed out alike, which is why it stands
// outside the member shell's gate.
//
// SIGNED IN, it lands the link's side (`confirmEmailChange` with the token)
// and says where that leaves the change — the first side or the last, or, for
// a link that outlived its change, what ended it, in the drawn words; a link
// the app does not know at all takes the `unknown` chip, naming no address.
// SIGNED OUT, it applies NOTHING: the anonymous check names the address the
// link confirms, and `Sign in` opens the sign-in holding the link; signed in
// again, the side applies and the signed-in landing follows.
//
// A DEAD OR UNKNOWN LINK SIGNED OUT (the signed-out board's `dead` chip) is
// one address-free landing whatever happened, and its `Sign in` NEVER holds
// the link (ChangeEmailLinkedSignedOut.md: a link that no longer works has
// nothing left for a sign-in to apply; the signed-in settings say where the
// email stands).
//
// A centred column with no header and no back arrow; one text button, the
// way on. The mark stands on every signed-in state but other-account, which
// takes the signed-out landing's markless construction (§14 R2): the mark is
// spent on the moment something worked.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { hasCode } from "@/lib/api/outcome";
import {
  confirmEmailChange,
  emailChangeLinkCheck,
  fetchSettingsAccount,
} from "@/lib/api/settings-api";
import {
  heldEmailChangeLink,
  holdEmailChangeLink,
  releaseEmailChangeLink,
} from "@/lib/session/held-link";
import { useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { TransportError } from "@/lib/ui/transport-error";

const NODE: DataNode = { path: "changeEmail" };
const node = (tail: string) => part(NODE, tail);

const DEAD = "This link doesn't work anymore";

/** The confirm's refusals a link landing has a drawn answer for. */
const ENDED_CODES: readonly ErrorCode[] = [
  "EMAIL_CHANGE_CANCELED",
  "EMAIL_CHANGE_ALREADY_APPLIED",
  "EMAIL_CHANGE_EXPIRED",
  "EMAIL_IN_USE",
  "EMAIL_CHANGE_OTHER_ACCOUNT",
];

/** One landing: what it says and where its one way on goes. */
export type Landing = {
  mark: boolean;
  title: string;
  body: string;
  /** `holdsLink`: the sign-in it opens carries the link to apply after. */
  onward: { label: string; href: string; holdsLink?: boolean };
};

const BACK_TO_SETTINGS = { label: "Back to settings", href: "/settings" };
const ENTER_THE_CODE = { label: "Enter the code", href: "/settings/email/confirm" };
/** The live link's sign-in, holding the link (ChangeEmailLinkedSignedOut.md). */
const SIGN_IN_HOLDING = { label: "Sign in", href: "/login", holdsLink: true };
/** A dead or unknown link's sign-in: NEVER holds the link (`:15`). */
const SIGN_IN = { label: "Sign in", href: "/login", holdsLink: false };

/** The signed-out `dead` chip's body (ChangeEmailLinkedSignedOut.jsx). */
const DEAD_SIGNED_OUT_BODY =
  "The change it belonged to may have run out, been canceled or already happened — this link can't move your email anymore.";
/** The signed-in `unknown` chip's body (ChangeEmailLinked.jsx, item 98). */
const UNKNOWN_SIGNED_IN_BODY =
  "It isn't a link CoGra knows — it may be mistyped, or from a change long gone. Your email stays as it is.";

/** The signed-in landing for a confirm's answer (ChangeEmailLinked.md). */
export function signedInLanding(
  answer:
    | { kind: "landed"; email: string; codeOwed: boolean; newEmail: string }
    | { kind: "ended"; code: string; email: string },
): Landing {
  if (answer.kind === "landed") {
    return answer.codeOwed
      ? {
          mark: true,
          title: "New address confirmed",
          body: `One side left: the code we sent to ${answer.email}. Your email moves once it's typed in.`,
          onward: ENTER_THE_CODE,
        }
      : {
          mark: true,
          title: "Email changed",
          body: `You sign in with ${answer.newEmail} from now on, and resets go there too.`,
          onward: BACK_TO_SETTINGS,
        };
  }
  switch (answer.code) {
    case "EMAIL_CHANGE_CANCELED":
      return {
        mark: true,
        title: DEAD,
        body: `The change it belonged to was canceled. Your email is still ${answer.email}.`,
        onward: BACK_TO_SETTINGS,
      };
    case "EMAIL_CHANGE_ALREADY_APPLIED":
      return {
        mark: true,
        title: DEAD,
        body: `The change it belonged to already happened. Your email is now ${answer.email}.`,
        onward: BACK_TO_SETTINGS,
      };
    case "EMAIL_CHANGE_EXPIRED":
      return {
        mark: true,
        title: DEAD,
        body: `The change it belonged to ran out before both sides landed. Your email is still ${answer.email}.`,
        onward: BACK_TO_SETTINGS,
      };
    case "EMAIL_IN_USE":
      // G4 (RULED): the member's way on is `Back to settings`.
      return {
        mark: true,
        title: "That address is taken now",
        body: "That address now belongs to another account. Your email stays as it is — if the address frees up before the change runs out, confirming again applies it.",
        onward: BACK_TO_SETTINGS,
      };
    case "EMAIL_CHANGE_OTHER_ACCOUNT":
      return {
        mark: false,
        title: "This link isn't for this account",
        body: "It confirms a new address for another account, so nothing changed here. Open it signed in as that account to finish the change.",
        onward: BACK_TO_SETTINGS,
      };
    default:
      // A token the confirm can tie to no change: the `unknown` chip, under
      // the mark, naming no address (ChangeEmailLinked.md, item 98).
      return { mark: true, title: DEAD, body: UNKNOWN_SIGNED_IN_BODY, onward: BACK_TO_SETTINGS };
  }
}

/** The signed-out landing for the anonymous check's answer. */
export function signedOutLanding(check: { newEmail: string; state: string } | null): Landing {
  if (check !== null && check.state === "PENDING") {
    return {
      mark: false,
      title: "Sign in to finish the change",
      body: `This link confirms ${check.newEmail} as your new address. It counts once you're signed in.`,
      onward: SIGN_IN_HOLDING,
    };
  }
  // Every other answer, and none: one landing that never says which
  // happened and never names an address (the `dead` chip).
  return { mark: false, title: DEAD, body: DEAD_SIGNED_OUT_BODY, onward: SIGN_IN };
}

export function EmailChangeView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const router = useRouter();
  const linked = useSearchParams().get("token");
  // The link a sign-in held (`held-link.ts`), read once on the first client
  // render: the server has no session storage to read.
  const [held] = useState(() => (typeof window === "undefined" ? null : heldEmailChangeLink()));
  const token = linked ?? held;
  const [answered, setAnswered] = useState<Landing | null>(null);
  // No token at all names no change: the link the app does not know, said at
  // once — the `unknown` chip signed in, the `dead` one signed out.
  const landing =
    token !== null
      ? answered
      : phase === "signedIn"
        ? signedInLanding({ kind: "ended", code: "UNKNOWN", email: "" })
        : phase === "signedOut"
          ? signedOutLanding(null)
          : null;
  const [unreachable, setUnreachable] = useState(false);
  // A link's side lands once; React's double-invoked dev effects must not
  // send it twice.
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (phase === "resolving" || token === null) return;
    const attempt = `${phase}:${token}`;
    if (fired.current === attempt) return;
    fired.current = attempt;

    if (phase === "signedOut") {
      void emailChangeLinkCheck(client, token).then((outcome) => {
        if (outcome.kind === "success") setAnswered(signedOutLanding(outcome.value));
        else setUnreachable(true);
      });
      return;
    }

    void (async () => {
      const outcome = await guard.run(() => confirmEmailChange(client, token));
      if (outcome.kind === "failed") {
        setUnreachable(true);
        return;
      }
      releaseEmailChangeLink();
      if (outcome.kind === "success") {
        const pending = outcome.value.pending;
        setAnswered(
          signedInLanding({
            kind: "landed",
            email: outcome.value.email ?? "",
            codeOwed: pending !== null && pending.requiresCode && !pending.codeConfirmed,
            newEmail: outcome.value.email ?? "",
          }),
        );
        return;
      }
      // An ended change names the address the account has now.
      const account = await guard.run(() => fetchSettingsAccount(client));
      const email = account.kind === "success" ? (account.value.email ?? "") : "";
      const code = ENDED_CODES.find((candidate) => hasCode(outcome, candidate)) ?? "UNKNOWN";
      setAnswered(signedInLanding({ kind: "ended", code, email }));
    })();
  }, [phase, token, client, guard]);

  const onward = (event: React.MouseEvent, target: Landing["onward"]) => {
    if (target.holdsLink === undefined) return;
    event.preventDefault();
    if (target.holdsLink && token !== null) {
      // A live link's `Sign in` opens the sign-in holding the link.
      holdEmailChangeLink(token);
    } else {
      // A dead one holds nothing — not even a link an earlier sign-in parked,
      // which would otherwise send the fresh session back here.
      releaseEmailChangeLink();
    }
    router.push(target.href);
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-8 text-center">
      {unreachable && <TransportError testId="email-change-unreachable" />}
      {landing !== null && (
        <>
          {landing.mark && (
            <span className="text-primary" {...testAttributes(node("mark"))}>
              <Icon name="mark" size={56} />
            </span>
          )}
          <h1
            className={`m-0 text-headline-small ${landing.mark ? "mt-6" : ""}`}
            {...testAttributes(node("title"))}
          >
            {landing.title}
          </h1>
          <p
            className="m-0 mt-2 max-w-[300px] text-body-medium text-on-surface-variant"
            {...testAttributes(node("body"))}
          >
            {landing.body}
          </p>
          <Link
            href={landing.onward.href}
            onClick={(event) => onward(event, landing.onward)}
            className={`${buttonClassName({ variant: "text" })} mt-6`}
            {...testAttributes(node("onward"))}
          >
            {landing.onward.label}
          </Link>
        </>
      )}
    </main>
  );
}
