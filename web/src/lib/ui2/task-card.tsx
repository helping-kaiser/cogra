"use client";

// THE TASK CARD (design/designs/canonical/screens/_shared.jsx `TaskCard`): a
// step the account owes, riding the feed as a card — the task ring around the
// card's ground, the title over the mark in the corner, the body in the
// secondary ink, then the card's own controls.
//
// THE NOTICE TONE IS THE ACCOUNT-NOTICE OLIVE (jakob 2026-10-02, the olive
// split): every ink — the outlined button and the ask link's block included —
// is scoped to the panel's own pair, the reason `inverse` exists, carried to
// the rest.

import type { CSSProperties, ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";

export function taskCardStyle(notice: boolean): CSSProperties {
  const ground = notice ? "var(--tertiary-container)" : "var(--surface-card)";
  const ink = notice ? "var(--on-tertiary-container)" : "var(--on-surface)";
  const scoped: Record<string, string> = notice
    ? {
        "--primary": ink,
        "--outline": ink,
        "--on-surface": ink,
        "--on-surface-variant": ink,
        "--text-secondary": ink,
      }
    : {};
  return {
    border: "var(--ring-task-width) solid transparent",
    background: `linear-gradient(${ground}, ${ground}) padding-box, var(--ring-task) border-box`,
    color: ink,
    ...scoped,
  };
}

export function TaskCard({
  title,
  body,
  tone,
  children,
  node,
  testId,
}: {
  title: ReactNode;
  body: ReactNode;
  tone?: "notice";
  children?: ReactNode;
  node?: DataNode;
  /** The card's own test id, where it registers no node. */
  testId?: string;
}) {
  return (
    <section
      {...testAttributes(node, testId)}
      className="box-border flex flex-none flex-col gap-3 rounded-medium p-4"
      style={taskCardStyle(tone === "notice")}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 text-title-medium" {...testAttributes(part(node, "title"))}>
          {title}
        </h2>
        <span className="flex-none text-primary">
          <Icon name="mark" size={20} pickColor="var(--primary-container)" />
        </span>
      </div>
      <p className="m-0 text-body-medium text-on-surface-variant" {...testAttributes(part(node, "body"))}>
        {body}
      </p>
      {children}
    </section>
  );
}
