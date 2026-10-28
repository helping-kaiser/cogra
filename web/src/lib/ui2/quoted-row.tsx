// THE THING BEING ANSWERED, HELD ABOVE THE ANSWER (design/components/core/
// QuotedRow.jsx): contained on a tone of its own and INERT — the reader is
// already inside the thing it names. A post's title line is its title and its
// author's handle; the snippet is one line and ellipsizes, the title never.
//
// `mark` stands where the face stands, for a thing whose face is not a
// person's (a tag's `#` tile). `attach` squares the top-left corner under a
// flag, so flag and row read as one folder-tab silhouette (the score's trace).
//
// THE BOARD'S 56px MINIMUM IS THE CONTENT'S, the 8px padding outside it
// (QuotedRow.jsx draws content-box: 72px on the built boards); the snippet
// takes the label-small size at the body's regular weight.

import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { MonogramAvatar } from "./monogram-avatar";

export function QuotedRow({
  title,
  snippet,
  name,
  src,
  mark,
  attach = false,
  node,
}: {
  title: string;
  snippet?: string | null;
  /** The face's name, for its monogram. */
  name?: string;
  src?: string | null;
  mark?: ReactNode;
  attach?: boolean;
  /** Names `title`, `snippet` and the face as `disc`. */
  node?: DataNode;
}) {
  return (
    <div
      className={`flex min-h-[72px] items-center gap-2 rounded-small bg-surface-container-highest px-3 py-2 ${
        attach ? "rounded-tl-none" : ""
      }`}
      {...testAttributes(node)}
    >
      {mark ?? <MonogramAvatar name={name ?? ""} src={src} size={32} node={part(node, "disc")} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-label-large" {...testAttributes(part(node, "title"))}>
          {title}
        </span>
        {snippet !== null && snippet !== undefined && snippet !== "" && (
          <span
            className="overflow-hidden text-ellipsis whitespace-nowrap text-label-small text-on-surface-variant [font-weight:400]"
            {...testAttributes(part(node, "snippet"))}
          >
            {snippet}
          </span>
        )}
      </span>
    </div>
  );
}
