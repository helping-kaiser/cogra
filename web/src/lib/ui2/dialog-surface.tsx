"use client";

// THE DIALOG SURFACE (design/components/core/JoinPrompt.jsx `DialogSurface`):
// a headline-small title, the body in the secondary ink, and the answers on
// one right-aligned row — over a scrim, the page beneath inert.
//
// Built on the native modal `<dialog>`, as `HelpDialog` and `RemoveConfirm`
// are: the top layer, the backdrop, modal focus containment and Escape come
// from the platform rather than being reimplemented. Focus lands on the TITLE
// when it opens (ChangeHandleConfirm.md, SignOutConfirm.md), so a listener
// hears what is being asked before any answer.
//
// `locked` holds the dialog up while its commitment is in flight: Escape, the
// scrim and system Back do nothing then — and nothing dims, either.

import { Fragment, useEffect, useRef, type ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { useCoversSurface } from "./covering-layer";

export function DialogSurface({
  title,
  body,
  actions,
  onDismiss,
  locked = false,
  node,
  testId,
  line,
  lineTestId,
  children,
}: {
  title: string;
  /**
   * One paragraph per entry, in the secondary ink. A string is wrapped in a
   * paragraph; a node is placed as it is, for a line that carries more than
   * words (the master's `asParagraphs`).
   */
  body: readonly ReactNode[];
  /** The answers, right-aligned on one row. */
  actions: ReactNode;
  /** Scrim, Escape or system Back — ignored while `locked`. */
  onDismiss: () => void;
  locked?: boolean;
  node?: DataNode;
  /** The dialog's own test id, where no registered node names it. */
  testId?: string;
  /**
   * THE FAULT THAT KEEPS A DIALOG UP (the master's `line`, seam 248): one line
   * in the failure register between the body and the answers — `That didn't
   * send. Try again.` — while the commitment's own slot reads `Retry`. Its own
   * slot rather than a body paragraph, so a registered dialog names it `line`
   * beside `title` and `body`.
   */
  line?: string;
  /** The line's test id, where no registered node names it. */
  lineTestId?: string;
  /** Anything the dialog says in itself beyond its body (an offline line). */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  useCoversSurface(true, "suspend");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (!dialog.open) dialog.showModal();
    titleRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-surface-title"
      onCancel={(event) => {
        // Escape (and system Back, which browsers route the same way): the
        // platform would close the dialog itself, so the decision is ours.
        event.preventDefault();
        if (!locked) onDismiss();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !locked) onDismiss();
      }}
      {...testAttributes(node, testId)}
      // `min(100vw − 2 × the dialog inset, the dialog's max width)`, the
      // board's own sizing (JoinPrompt.jsx: `--dialog-inset` 32px,
      // `--dialog-max-width` 20rem).
      className="cg-dialog-in m-auto w-[min(calc(100vw_-_4rem),20rem)] rounded-extra-large border-0 bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <h2
        id="dialog-surface-title"
        ref={titleRef}
        tabIndex={-1}
        className="m-0 text-headline-small outline-none"
        {...testAttributes(part(node, "title"))}
      >
        {title}
      </h2>
      <div
        className="mt-4 flex flex-col gap-4 text-body-medium text-on-surface-variant"
        {...testAttributes(part(node, "body"))}
      >
        {body.map((paragraph, index) =>
          typeof paragraph === "string" ? (
            <p key={paragraph} className="m-0">
              {paragraph}
            </p>
          ) : (
            <Fragment key={index}>{paragraph}</Fragment>
          ),
        )}
      </div>
      {line !== undefined && (
        <p
          role="alert"
          className="m-0 mt-4 text-body-medium text-error"
          {...testAttributes(part(node, "line"), lineTestId)}
        >
          {line}
        </p>
      )}
      {children}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </dialog>
  );
}
