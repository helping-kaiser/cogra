"use client";

// PEOPLE YOU LET IN (Invites.md:7-27; the board's `letIn` chip, rounds 38 and
// 40; copy-voice *The invites round*). Every person the reader vouched in, the
// newest first — `vouchedIn`'s own order, each person under their first
// voucher only, a stance walked back since wearing no mark — in the
// application row's anatomy without its control: the picture, else the
// monogram from the name; the display name, else the handle; when they were
// let in, in the page's age form. No status line: nothing waits on anyone
// here. The row carries no control and wears the chevron, because it opens
// the person's profile, whose arrow reads `Back to Invites`.
//
// NO LIST IS UNCAPPED IN ITS DEFAULT STATE (round 40): three rows, then `Show
// all` under the third — an inline action under the rows — which opens the
// rest in place: the list grows, the door leaves, nothing else leaves the
// page, and no "show fewer" follows (:15-19).
//
// A DELETED ACCOUNT keeps its place and its age (:25): the reserved disc and
// `Deleted account` in the system's voice, no handle, keyed by the person's
// id — and it is still a door, to the deleted account's page (:27).

import { useEffect, useRef, useState } from "react";

import type { LetInPerson } from "@/lib/api/invites-api";
import { PEOPLE_LABEL, PEOPLE_SHOWN, SHOW_ALL } from "@/lib/invites/queue";
import { letInOrigin, personHref } from "@/lib/ui/back-origin";
import { instance, part, type DataNode } from "@/lib/ui/data-node";
import { ladderAge } from "@/lib/ui/timestamp";
import { ContentRow, type ContentRowDisc } from "@/lib/ui2/content-row";
import { InlineAction } from "@/lib/ui2/inline-action";
import { SectionLabel } from "@/lib/ui2/section-label";

function discOf(person: LetInPerson): ContentRowDisc {
  if (person.redacted) return { kind: "redacted" };
  if (person.avatarUrl !== null) return { kind: "picture", src: person.avatarUrl, name: person.monogram };
  return { kind: "monogram", name: person.monogram };
}

export function PeopleLetIn({
  people,
  now,
  from,
  root,
}: {
  /** Newest first, as `vouchedIn` serves them. */
  people: readonly LetInPerson[];
  now: number;
  /** The origin Invites itself was opened with, chained into each door. */
  from: string | null;
  root: DataNode;
}) {
  const [opened, setOpened] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const focusOpened = useRef(false);

  // THE DOOR LEAVES UNDER THE PRESS, so focus moves to the first row it
  // opened rather than falling to the page (WAI-ARIA APG, *Disclosure*: the
  // control that is removed hands focus on, never to the document).
  useEffect(() => {
    if (!opened || !focusOpened.current) return;
    focusOpened.current = false;
    const rows = list.current?.querySelectorAll<HTMLElement>(":scope > div > a");
    rows?.[PEOPLE_SHOWN]?.focus();
  }, [opened]);

  // Absent, label and all, until someone is let in (:9).
  if (people.length === 0) return null;

  const capped = !opened && people.length > PEOPLE_SHOWN;
  const shown = capped ? people.slice(0, PEOPLE_SHOWN) : people;
  const via = letInOrigin(from);

  return (
    <div className="flex flex-col">
      <SectionLabel node={part(root, "peopleLabel")}>{PEOPLE_LABEL}</SectionLabel>
      <div ref={list} className="flex flex-col gap-2 px-4">
        {shown.map((person) => (
          <ContentRow
            key={person.id}
            variant="chronicle"
            chevron
            title={person.name ?? ""}
            trailing={ladderAge(person.vouchedAt, now)}
            disc={discOf(person)}
            href={personHref(person.door, via)}
            node={instance(root, person.redacted ? "redactedPerson" : "person", person.id)}
            testId={`invites-person-${person.id}`}
          />
        ))}
        {capped && (
          <div className="flex">
            <InlineAction
              size="sm"
              node={part(root, "peopleDoor")}
              onClick={() => {
                focusOpened.current = true;
                setOpened(true);
              }}
            >
              {SHOW_ALL}
            </InlineAction>
          </div>
        )}
      </div>
    </div>
  );
}
