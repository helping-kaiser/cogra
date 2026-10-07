"use client";

// ABOUT COGRA (design/designs/canonical/screens/About.jsx; behavior/About.md).
// Nine topics as rows, every one closed on open; a topic's whole row is its
// control, says whether it is open, and unfolds its answer under itself
// without touching the others. The header stays pinned, with no "?" and no
// bottom bar. The words are the board's, verbatim.
//
// The back arrow follows the door: `Back to settings` from Settings, a plain
// `Back` from the join form's "?" (`?from=settings` names the first).

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { PageHeader } from "@/lib/ui/page-header";

const NODE: DataNode = { path: "about" };

/** The topics in the drawn order, each answer's paragraphs verbatim. */
export const TOPICS: readonly { title: string; answer: readonly string[] }[] = [
  {
    title: "What this is",
    answer: [
      "CoGra is a place to read and write in public, where what reaches you is decided by the people and the things you have pointed at — never by a system guessing what will keep you here.",
    ],
  },
  {
    title: "Your feed is your own steps",
    answer: [
      "Posts arrive along the connections you made, one step at a time. Nothing is put in front of you because it performs well, and there is no feed you did not shape.",
      "You can change what a feed shows whenever you like, and you can open any post's score to see exactly which steps carried it to you.",
    ],
  },
  {
    title: "Everything here is public",
    answer: [
      "Posts, comments, opinions, tags, citations — and chats, once they arrive. Anything written on CoGra can be read, quoted and cited by anyone.",
      "There is no private side to this. If something is not meant to be read by strangers, it is not meant for here.",
    ],
  },
  {
    title: "An opinion says two things",
    answer: [
      "Every opinion you give carries two: how far you are for or against the thing, and how much of it you want reaching you. The pad is where you place both at once.",
      "The face beside an opinion is a short reading of that pair, not a separate rating. You can turn the exact numbers on in settings.",
    ],
  },
  {
    title: "Nothing is lost",
    answer: [
      "Posts and comments are built in layers, and a layer is never taken away. An edit adds to the record instead of replacing it, so what you are reading carries its own history.",
      "When something does have to go — the law, or the author's own choice — the words are removed and a mark stays where they were. Nothing disappears quietly.",
    ],
  },
  {
    title: "Money follows the reach you made",
    answer: [
      "Reading and writing here can earn, and what you earn is yours.",
      "Advertising is pull, not push: a campaign offers to pay for reach, and where that money lands is decided the same way a feed is — by the graph, not by the bid. Nobody buys their way into what you see.",
      "Every figure opens onto what produced it, down to the record that paid it.",
    ],
  },
  {
    title: "Getting in, and being let in",
    answer: [
      "CoGra is invite-only. Somebody already here vouches for you, and until they have, you are an applicant: you can read everything, write one post, give one opinion and say how you feel about one topic.",
      "These wait with your application and arrive with you. Until then only you can see them, and they are signed together with the vouch that lets you in. If your application is closed, your account stays — anyone can still vouch you in.",
      "That is not a waiting period for its own sake. The first link to you is a real one, given by a person who stands behind it — which is the thing that keeps this place small enough to be honest.",
    ],
  },
  {
    title: "Your key is yours",
    answer: [
      "Everything you publish is signed by a key only you hold. We cannot sign for you, and we cannot recover it for you — your recovery code is the only way back.",
    ],
  },
  {
    title: "This page grows",
    answer: [
      "CoGra is being built, and this page describes the product rather than the build. Some of what is written here is already in your hands; some of it is on its way.",
    ],
  },
];

/** The registry's topic key: the title lowercased, each run of other characters one `-`. */
export function topicKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AboutView() {
  const fromSettings = useSearchParams().get("from") === "settings";
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      <div className="sticky top-0 z-10 bg-surface">
        <PageHeader
          title="About CoGra"
          backHref={fromSettings ? "/settings" : "/"}
          backLabel={fromSettings ? "Back to settings" : "Back"}
          node={part(NODE, "header")}
        />
      </div>
      <div className="flex flex-col px-6 pb-8 pt-2">
        {TOPICS.map((topic) => {
          const key = topicKey(topic.title);
          const node = instance(NODE, "topic", key);
          const isOpen = open.has(key);
          return (
            <section key={key} className="flex flex-col" {...testAttributes(node)}>
              <h2 className="m-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(key)}
                  className="cg-state cg-focus flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-2 text-left font-sans text-title-small text-on-surface"
                  {...testAttributes(part(node, "row"))}
                >
                  <span className="min-w-0 flex-1" {...testAttributes(part(node, "row.title"))}>
                    {topic.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`inline-flex flex-none text-on-surface-variant ${isOpen ? "rotate-180" : ""}`}
                    {...testAttributes(part(node, "row.chevron"))}
                  >
                    <Icon name="expand_more" size={20} />
                  </span>
                </button>
              </h2>
              {isOpen && (
                <div className="flex flex-col gap-2 pb-4" {...testAttributes(part(node, "answer"))}>
                  {topic.answer.map((line) => (
                    <p key={line} className="m-0 text-body-medium text-on-surface-variant">
                      {line}
                    </p>
                  ))}
                </div>
              )}
              <div aria-hidden="true" className="h-px bg-outline-variant" />
            </section>
          );
        })}
      </div>
    </main>
  );
}
