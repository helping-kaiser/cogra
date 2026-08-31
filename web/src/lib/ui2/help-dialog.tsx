"use client";

// The house help dialog — the one thing a `?` opens (the HelpDialog board).
//
// A plain centred dialog: a title, at most two short paragraphs, and Close. It
// explains rather than asks, so it carries no choice and no destructive action;
// the texts are copy-voice's, verbatim, because the wording IS the design here.
//
// One `?` per screen (design/readme.md §13), so this is opened from a header's
// help slot or from a sheet's own `?`, never from both at once.

import { useEffect, useRef } from "react";

import { PillButton } from "./pill-button";

export type HelpTopic = {
  readonly title: string;
  /** At most two, per the copy rule. */
  readonly paragraphs: readonly string[];
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
      className="m-auto w-[calc(100%-3.375rem)] max-w-[22rem] rounded-extra-large border-0 bg-surface-container-high p-6 text-on-surface backdrop:bg-scrim/50"
    >
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-headline-small">{topic.title}</h2>
        {topic.paragraphs.map((paragraph) => (
          <p key={paragraph} className="m-0 text-body-medium">
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
  signedActions: {
    title: "Signed actions",
    paragraphs: [
      "Each piece of a post — the post itself, every topic, every citation — is its own signed action, written in your name. They sign together: all of them land, or none does.",
      "You don't pay for these — a shared community pool covers members' signings. The pool is real and finite, so each action still counts.",
    ],
  },
  markingAsSensitive: {
    title: "Marking as sensitive",
    paragraphs: [
      "The mark veils the pictures and the description until a reader chooses to look. The title stays readable, so choosing is informed.",
      "Your reason, if you give one, is shown on the veil. The mark is public and travels with the post.",
    ],
  },
  describingPictures: {
    title: "Describing pictures",
    paragraphs: [
      "A description is read aloud by screen readers and shown when a picture can't load — plain words about what's there. It travels with the picture, public like the rest of the post.",
      "Nothing is described for you: a picture without a description is skipped by screen readers, never guessed at.",
    ],
  },
  changingYourPicture: {
    title: "Changing your picture",
    paragraphs: [
      "Your profile is a public record, and changes to it are signed actions in your name — the picture changes the moment yours lands.",
      "The community pool covers the signing, like your posts. The record that you changed it stays, like every signed action.",
    ],
  },
} as const satisfies Record<string, HelpTopic>;
