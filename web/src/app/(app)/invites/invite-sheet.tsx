"use client";

// THE CREATE SHEET, IN ITS TWO STAGES, AND THE EXPIRY CHOOSER OVER IT
// (InviteNew.jsx, InviteCreated.jsx, InviteExpiry.jsx; behavior InviteNew.md,
// InviteCreated.md, InviteExpiry.md).
//
// TWO DECISIONS AND NO MORE (InviteNew.md:3-5): who may use the link — the
// switch worded as the restriction, on when the sheet opens — and how long it
// lives, `7 days` when it opens. No opinion control: a link carries no stance.
// `Create invite` makes the link with the staged choices and the sheet turns to
// its second stage, the fresh link; past 200ms it reads `Creating invite…`, and
// a create that did not go through answers in the network fault's grammar with
// the choices kept (:19-23).
//
// THE FRESH LINK'S STAGE SERVES THE LINK AND NOTHING ELSE (InviteCreated.md):
// `Your invite link`, the link whole in mono with its label and caption, its
// copy control, and `Share link` — the platform's own sheet, or the clipboard
// with `Link copied` where there is none. Closed, the sheet lands on Invites
// with the new link under Live links.
//
// THE CHOOSER STACKS OVER THE SHEET (InviteExpiry.md): three lengths, exactly
// one selected, a tap picks and closes with no Done; the scrim, a swipe, Back
// or Escape close it with the length it had.

import { useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { createInviteLink, type InviteLinkView } from "@/lib/api/invites-api";
import {
  COPY_THE_LINK,
  CREATE_FOOTNOTE,
  CREATE_INVITE,
  CREATING_INVITE,
  DEFAULT_EXPIRY,
  EXPIRES_AFTER,
  EXPIRY_CHOICES,
  LINK_COPIED,
  NEW_INVITE,
  ONLY_ONE_PERSON,
  SHARE_LINK,
  YOUR_INVITE_LINK,
  copyLink,
  expiryKey,
  joinUrl,
  linkCaption,
  linkLabel,
  type ExpiryChoice,
} from "@/lib/invites/queue";
import { useAuthGuard } from "@/lib/session/runtime";
import { buttonClassName } from "@/lib/ui/button";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { shareLink } from "@/lib/ui/share";
import { TransportError } from "@/lib/ui/transport-error";
import { AddressCard } from "@/lib/ui2/address-card";
import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { SettingsGroup, SettingsRow } from "@/lib/ui2/settings-row";

/** How long the create may stay unanswered before it says it is working. */
export const CREATING_AFTER_MS = 200;

// The registered sheets (nodes.json InviteNew, InviteCreated, InviteExpiry): one
// web sheet serves both stages, so its node follows the stage it shows.
const CREATE_SHEET: DataNode = { path: "invites.createSheet" };
const OPTIONS = part(CREATE_SHEET, "options");
const LINK_SHEET: DataNode = { path: "invites.linkSheet" };
const EXPIRY_SHEET: DataNode = { path: "invites.expirySheet" };

export function InviteSheet({
  open,
  onClose,
  onCreated,
  notify,
  now = Date.now,
}: {
  open: boolean;
  /** Closes onto Invites; a link created stands under Live links from there. */
  onClose: () => void;
  onCreated: (link: InviteLinkView) => void;
  /** The page's one snackbar. */
  notify: (message: string) => void;
  /** Test injection: the clock the link's expiry is reckoned from. */
  now?: () => number;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [singleUse, setSingleUse] = useState(true);
  const [expiry, setExpiry] = useState<ExpiryChoice>(DEFAULT_EXPIRY);
  const [choosing, setChoosing] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [created, setCreated] = useState<InviteLinkView | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => {
    if (inFlight) return;
    setChoosing(false);
    onClose();
    // The next open starts over at the drawn defaults.
    setCreated(null);
    setFailed(false);
    setSingleUse(true);
    setExpiry(DEFAULT_EXPIRY);
  };

  const create = async () => {
    if (inFlight) return;
    setInFlight(true);
    setFailed(false);
    timer.current = setTimeout(() => setSlow(true), CREATING_AFTER_MS);
    const outcome = await guard.run(() =>
      createInviteLink(client, {
        expiresAt: new Date(now() + expiry.ms).toISOString(),
        singleUse,
      }),
    );
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setSlow(false);
    setInFlight(false);
    if (outcome.kind === "success") {
      setCreated(outcome.value);
      onCreated(outcome.value);
    } else {
      // The staged choices stay as they were (:23).
      setFailed(true);
    }
  };

  const url = created === null ? "" : joinUrl(window.location.origin, created.id);

  return (
    <>
      <BottomSheet
        open={open}
        onClose={close}
        title={created === null ? NEW_INVITE : YOUR_INVITE_LINK}
        testId="invites-sheet"
        node={created === null ? CREATE_SHEET : LINK_SHEET}
      >
        {created === null ? (
          <div className="flex flex-col gap-4">
            <SettingsGroup footnote={CREATE_FOOTNOTE} node={OPTIONS}>
              <SettingsRow
                label={ONLY_ONE_PERSON}
                checked={singleUse}
                onOpen={() => setSingleUse((on) => !on)}
                node={part(OPTIONS, "singleUse")}
              />
              <SettingsRow
                label={EXPIRES_AFTER}
                value={expiry.label}
                onOpen={() => setChoosing(true)}
                node={part(OPTIONS, "expiry")}
              />
            </SettingsGroup>
            {failed && <TransportError testId="invites-sheet-failed" />}
            <div className="flex justify-end">
              <button
                type="button"
                {...testAttributes(part(CREATE_SHEET, "create"))}
                onClick={inFlight ? undefined : () => void create()}
                aria-busy={inFlight || undefined}
                aria-disabled={inFlight || undefined}
                className={buttonClassName({ variant: "primary" })}
              >
                {slow ? CREATING_INVITE : CREATE_INVITE}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AddressCard
              address={url}
              label={linkLabel(created)}
              copyLabel={COPY_THE_LINK}
              onCopy={() => void copyLink(url).then((copied) => copied && notify(LINK_COPIED))}
              caption={linkCaption(created, now())}
              node={part(LINK_SHEET, "link")}
            />
            <button
              type="button"
              {...testAttributes(part(LINK_SHEET, "share"))}
              onClick={() =>
                void shareLink(url).then((outcome) => outcome === "copied" && notify(LINK_COPIED))
              }
              className={`w-full ${buttonClassName({ variant: "primary" })}`}
            >
              {SHARE_LINK}
            </button>
          </div>
        )}
      </BottomSheet>
      <BottomSheet
        open={open && choosing}
        onClose={() => setChoosing(false)}
        title={EXPIRES_AFTER}
        stacked
        testId="invites-expiry"
        node={EXPIRY_SHEET}
      >
        <div className="flex flex-col px-2" role="radiogroup" aria-label={EXPIRES_AFTER}>
          {EXPIRY_CHOICES.map((choice) => (
            <SettingsRow
              key={choice.label}
              name="invite-expiry"
              label={choice.label}
              selected={choice.label === expiry.label}
              node={instance(EXPIRY_SHEET, "expiryOption", expiryKey(choice))}
              onOpen={() => {
                setExpiry(choice);
                setChoosing(false);
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
