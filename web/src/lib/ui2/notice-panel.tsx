"use client";

// THE TERTIARY NOTICE (design/components/honesty/NoticePanel.jsx): the honesty
// idiom for a state where nothing was staged, signed or spent — the missing
// key, the write rule, the seal's own bug. Never the error colour and never the
// failure voice: the reader did nothing wrong. A `title-medium` heading with
// the stopper exception's "?" beside it when the notice carries one (an
// `inverse` HelpDot, ringed in the panel's own ink), then its lines and its
// filled `inverse` act.

import type { ReactNode } from "react";

import { HelpDot } from "./help-dot";

export function NoticePanel({
  title,
  help,
  testId,
  corner = "medium",
  children,
}: {
  title: string;
  /** The one thing the copies disagree on (NoticePanel.jsx): a page-leading panel is `large`. */
  corner?: "medium" | "large";
  /** The stopper exception's own "?" — named by its dialog. */
  help?: { label: string; onOpen: () => void; testId?: string };
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={`flex flex-col gap-3 ${corner === "large" ? "rounded-large" : "rounded-medium"} bg-tertiary-container p-4 text-on-tertiary-container`}
    >
      <div className="flex items-center gap-2">
        <h2 className="m-0 flex-1 text-title-medium">{title}</h2>
        {help && <HelpDot ariaLabel={help.label} onOpen={help.onOpen} testId={help.testId} variant="inverse" />}
      </div>
      {children}
    </div>
  );
}

/** The panel's sentence — `body-medium` in the panel's own ink. */
export function NoticeLine({ children }: { children: ReactNode }) {
  return <p className="m-0 text-body-medium">{children}</p>;
}
