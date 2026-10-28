"use client";

// The house help dialog — the one thing a `?` opens (the HelpDialog board).
//
// A plain centred dialog: a title, at most two short paragraphs, and Close. It
// explains rather than asks, so it carries no choice and no destructive action;
// the texts are copy-voice's, verbatim, because the wording IS the design here.
//
// One `?` per screen (design/readme.md §13), so this is opened from a header's
// help slot or from a sheet's own `?`, never from both at once.

import { useEffect, useRef, type ReactNode } from "react";

import { attachmentWords } from "@/lib/ui/attachment-readout";
import { useCoversSurface } from "./covering-layer";
import { PillButton } from "./pill-button";

export type HelpTopic = {
  readonly title: string;
  /**
   * At most two, per the copy rule. A paragraph is words, or words carrying a
   * `cg-exact` tail (readme §13): copy-voice italicises the digits a reader
   * sees only in exact mode, and a node is how a paragraph carries that span.
   */
  readonly paragraphs: readonly ReactNode[];
};

export function HelpDialog({
  open,
  onClose,
  topic,
  testId = "help-dialog",
}: {
  open: boolean;
  onClose: () => void;
  topic: HelpTopic;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  // A dialog over a surface suspends its stage (Feed.md:31, `covering-layer.tsx`).
  useCoversSurface(open, "suspend");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-label={topic.title}
      onClose={onClose}
      // A press outside closes it: it is an explanation, not a decision, so
      // there is nothing to lose by dismissing it.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="cg-dialog-in m-auto w-[calc(100%-3.375rem)] max-w-[22rem] rounded-extra-large border-0 bg-surface-container-high p-6 text-on-surface backdrop:bg-scrim/50"
    >
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-headline-small">{topic.title}</h2>
        {topic.paragraphs.map((paragraph, index) => (
          <p key={index} className="m-0 text-body-medium">
            {paragraph}
          </p>
        ))}
        <div className="flex justify-end">
          <PillButton testId={`${testId}-close`} onClick={onClose}>
            Close
          </PillButton>
        </div>
      </div>
    </dialog>
  );
}

// The texts, verbatim from design/guidelines/copy-voice.md. They live beside the
// component so a screen names a topic rather than retyping the words — a
// paraphrase here would be a design change made by accident.
export const HELP_TOPICS = {
  // The write rule's notice on the opinion pad (copy-voice, *Why signing
  // waits*; PadWriteRule.md): the pad keeps no draft, so the second
  // paragraph's clause is the pad's own (blessed jakob 2026-10-01).
  whySigningWaitsOnPad: {
    title: "Why signing waits",
    paragraphs: [
      "There's a limit to how many signed actions can go through in a short time — it keeps the network safe from flooding. You've hit it for now.",
      "Nothing was signed or spent. Try again in a little while.",
    ],
  },
  // The same dialog from the post's seal, whose draft is kept (copy-voice,
  // *Why signing waits*, blessed jakob 2026-10-01).
  whySigningWaits: {
    title: "Why signing waits",
    paragraphs: [
      "There's a limit to how many signed actions can go through in a short time — it keeps the network safe from flooding. You've hit it for now.",
      "Nothing was signed or spent, and your draft is kept. Try again in a little while.",
    ],
  },
  // The same dialog from the kept picks' seal, which keeps the picks (copy-voice,
  // *Why signing waits*, blessed jakob 2026-10-05).
  whySigningWaitsKept: {
    title: "Why signing waits",
    paragraphs: [
      "There's a limit to how many signed actions can go through in a short time — it keeps the network safe from flooding. You've hit it for now.",
      "Nothing was signed or spent, and your picks are still kept. Try again in a little while.",
    ],
  },
  // The same dialog from an edit, which keeps no draft: the clause says what is
  // true there (copy-voice, *Why signing waits*: "from a comment edit,
  // `Nothing was signed or spent, and your edit is still here. Try again in a
  // little while.`"; the post edit's mirror, blessed jakob 2026-10-16).
  whySigningWaitsAtEdit: {
    title: "Why signing waits",
    paragraphs: [
      "There's a limit to how many signed actions can go through in a short time — it keeps the network safe from flooding. You've hit it for now.",
      "Nothing was signed or spent, and your edit is still here. Try again in a little while.",
    ],
  },
  // The seal's own "?" — the post's and the reply's (copy-voice, *How signing
  // works*; payer-neutral by the v1.0.0 scope cut, jakob 2026-09-25).
  howSigningWorks: {
    title: "How signing works",
    paragraphs: [
      "Each piece of a post — the post itself, every tag, every citation — is signed on its own, in your name. They sign together: all of them land, or none does.",
      "Each signing is paid for — the cost is real, so each one still counts.",
    ],
  },
  license: {
    title: "License",
    paragraphs: [
      "Terms for anyone who reuses what you publish — credit, and a public record of use. They are not a statement about how you made it.",
      "The license is set when the post is first signed and can never change, not even by an edit. Your default lives in settings — Public domain until you change it.",
    ],
  },
  markingAsSensitive: {
    title: "Marking as sensitive",
    paragraphs: [
      "The mark veils the pictures and the words until a reader chooses to look. The title stays readable, so choosing is informed.",
      "Your reason, if you give one, is shown on the veil. The mark is public and travels with the post.",
    ],
  },
  describingPictures: {
    title: "Describing pictures",
    paragraphs: [
      "A description is read aloud by screen readers and shown when a picture can't load — plain words about what's there. It travels with the picture, public like the rest of the post. A video takes one description for the whole clip; its cover takes none of its own.",
      "Nothing is described for you: a picture without a description is skipped by screen readers, never guessed at.",
    ],
  },
  // The tag picker's one "?" (copy-voice, *Tagging*, the K13 round): the
  // dot is named by the dialog it opens.
  tagging: {
    title: "Tagging",
    paragraphs: [
      "A tag is a name anyone can use — nobody owns one, and using a name nobody has used before takes no extra step. Tagging is its own signed action, and it carries how much the post is about that tag.",
      "Names are lowercased, and a name can hold letters, digits, dot, dash and underscore. Tap a tag you have added to set how it relates.",
    ],
  },
  // The citation picker's one "?" (copy-voice, *Citing*; trimmed to v1.0.0's
  // citable kinds, jakob 2026-09-25).
  citing: {
    title: "Citing",
    paragraphs: [
      "A citation is its own signed action and carries an opinion of what you cite. You can cite a post, a comment or a person.",
      'A comment can also be cited from itself — open its menu and choose "Cite in a new post".',
    ],
  },
  editing: {
    title: "Editing",
    paragraphs: [
      'An edit signs a full new version on top; earlier versions stay public under "Edited". An edit never bumps it as new.',
      "Tag and citation changes ride the same signing, each as its own signed action. The license never changes.",
    ],
  },
  changingYourPicture: {
    title: "Changing your picture",
    paragraphs: [
      // Nothing more: the picture changing when it lands is expected, and
      // a "?" explains only what is new (copy-voice, jakob 2026-10-20).
      "Your profile is a public record, and changes to it are signed actions in your name.",
      "The signing is paid for, like your posts. The record that you changed it stays, like every signed action.",
    ],
  },
  // The one-axis pad on your own post — the seal's and a post edit's
  // (copy-voice, *Your backing on your post*; blessed jakob 2026-10-16,
  // round 15). Its own topic, not the reply pad's: a reply signs an
  // opinion on somebody else's post with both axes, and this is the
  // authoring BACKING, one axis.
  //
  // copy-voice italicises `(+0.10)`: the italic tails are the `cg-exact`
  // spans (readme §13), so the face is drawn in both reading modes, the
  // digits only for a reader who asked for exact values, and the spoken
  // twin says both either way.
  yourBackingOnYourPost: {
    title: "Your backing on your post",
    paragraphs: [
      <>
        Publishing also signs your backing of your own post — for or against, from a gentle{" "}
        <span aria-hidden="true">🙂</span>
        <span aria-hidden="true" className="cg-exact">
          {" (+0.10)"}
        </span>
        <span className="sr-only">{attachmentWords(0.1)}</span> by default. An edit adds to it,
        starting at nothing, so an edit you don&apos;t adjust leaves it as it is.
      </>,
      "How much of it reaches you isn't part of publishing: once the post is out, give it an opinion on its face, like anyone's. Nothing is signed until Set. Swap the input in settings if you prefer sliders or numbers.",
    ],
  },
  yourKey: {
    title: "Your key",
    paragraphs: [
      "Signing needs your key, and it isn't on this browser — nothing is signed without it.",
      "A recovery code brings the key to any device. Until it's here, anything waiting on it stays on this device.",
    ],
  },
  // Explore's results' "?" (copy-voice, *Searching*; re-voiced for the
  // unified sigil law, blessed jakob 2026-10-16).
  searching: {
    title: "How searching works",
    paragraphs: [
      "Search reads names, handles and titles, never bodies. Start with @ to find people by their handle — what they made follows them. Start with # to find tags and what carries them.",
      "Results put what's closest to you first — the numbers are your view, no one else's. Below the line, what's still beyond your reach, newest first. Your searches stay on this device.",
    ],
  },
  // The feed filter sheet's "?" — the feed's and Settings' What your feed shows
  // (copy-voice, *The filter*: the feed's seen sentence follows the seen tail,
  // jakob 2026-10-14; FeedSheet.md: "the feed filter's \"?\" says What you've
  // already seen waits below the Already seen line unless you ask for it back").
  theFeedFilter: {
    title: "How the filter works",
    paragraphs: [
      "What you let in, and in what order — the kinds combine freely, ranked or newest is one choice, and what you've already seen waits below the Already seen line unless you ask for it back. Nothing changes until you press Done, and nothing here is signed or shared.",
      "It lasts until you change it, on this device only. Reset brings back your defaults, to change them go to settings.",
    ],
  },
  // The search filter sheet's "?" (copy-voice, *The filter*: the search's own
  // seen sentence; the Reset sentence jakob's own, blessed 2026-10-02).
  theSearchFilter: {
    title: "How the filter works",
    paragraphs: [
      "What you let in, and in what order — the kinds combine freely, ranked or newest is one choice, and what you've already seen stays out unless you ask for it back. Nothing changes until you press Done, and nothing here is signed or shared.",
      "It lasts until you change it, on this device only. Reset brings back your defaults, to change them go to settings.",
    ],
  },
} as const satisfies Record<string, HelpTopic>;
