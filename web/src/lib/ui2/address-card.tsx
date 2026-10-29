"use client";

// THE LONG-OPAQUE-STRING CARD (design/components/wallet/PayoutAddress.jsx,
// `PayoutAddress`): a string no reader can check by eye, held whole — mono,
// wrapped, never truncated — with its label, a copy control and at most one
// inline word beside the label, and a quiet caption under it. The wallet's
// payout address first; the invite link (`Invites`, `InviteCreated`) and the
// applicant's ask link (`ApplicantWaiting`, `ApplicantRejected`,
// `ProfileApplicant`) wear the same card, each passing its own words.
//
// `bare` DROPS THE CONTAINER AND KEEPS THE ANATOMY: for the string held inside
// something that already frames it (the applicant's ask link inside its task
// card) — the fill and the inset go; the label, the copy control, the mono
// block and the caption are unchanged.
//
// `children` STANDS UNDER THE CAPTION, the card's last line (PayoutAddress.jsx):
// the copy that did not go through says so there (Invites.md, `copyFault`).

import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { InlineAction } from "./inline-action";

export function AddressCard({
  address,
  label,
  onCopy,
  copyLabel,
  action,
  caption,
  bare = false,
  node,
  testId,
  children,
}: {
  /** The card's last line, under the caption. */
  children?: ReactNode;
  address: string;
  label: string;
  onCopy?: () => void;
  /** The copy control's only name — it carries no word on screen. */
  copyLabel: string;
  /** The card's one inline word (`Revoke`), waiting as the pill does. */
  action?: {
    readonly label: string;
    readonly onClick: () => void;
    readonly busy?: boolean;
    readonly busyLabel?: string;
  };
  caption?: string;
  bare?: boolean;
  /** The registered card: its label, copy, action, address and caption are parts. */
  node?: DataNode;
  testId?: string;
}) {
  return (
    <div
      {...testAttributes(node, testId)}
      className={`flex flex-col gap-2 ${bare ? "" : "rounded-medium bg-surface-container-highest px-4 py-3"}`}
    >
      <div className="flex items-center gap-2">
        <span
          {...testAttributes(part(node, "label"))}
          className="flex-1 text-label-medium text-on-surface-variant"
        >
          {label}
        </span>
        {onCopy !== undefined && (
          <button
            type="button"
            aria-label={copyLabel}
            onClick={onCopy}
            {...testAttributes(part(node, "copy"), testId && `${testId}-copy`)}
            className="cg-state cg-focus cg-hit grid size-8 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-on-surface-variant"
          >
            <Icon name="content_copy" size={18} />
          </button>
        )}
        {action !== undefined && (
          <InlineAction
            onClick={action.onClick}
            busy={action.busy}
            busyLabel={action.busyLabel}
            node={part(node, "action")}
            testId={testId && `${testId}-action`}
          >
            {action.label}
          </InlineAction>
        )}
      </div>
      <code
        {...testAttributes(part(node, "address"))}
        className="font-mono text-body-small text-on-surface [overflow-wrap:anywhere] [word-break:break-all]"
      >
        {address}
      </code>
      {caption !== undefined && (
        <span
          {...testAttributes(part(node, "caption"))}
          // The master sets label-small's size, leading and tracking only — the
          // weight is the ground's (PayoutAddress.jsx), never the role's 500.
          className="text-[length:var(--text-label-small)] text-on-surface-variant"
          style={{
            lineHeight: "var(--text-label-small--line-height)",
            letterSpacing: "var(--text-label-small--letter-spacing)",
          }}
        >
          {caption}
        </span>
      )}
      {children}
    </div>
  );
}
