"use client";

// REPORT A PROBLEM (design/designs/canonical/ReportProblem, ReportProblemEmpty;
// the page is the boards' shared `ReportProblemBody`). One page whichever door
// opened it — Settings' `Report a problem` row or a seal's bug notice — and it
// carries nothing about where it was opened from (ReportProblem.md:3).
//
// A TASK PAGE (ReportProblem.md:11): the back arrow and no bottom bar. Then the
// headline, the lead, the one field `What happened` (four lines, growing a line
// at a time — `TextField`'s growth law), the four facts read back in the seal's
// fact list, the line saying nothing else travels, and `Send by email` — which
// stands AFTER the read-back, the two-placement law's stated exception
// (ReportProblem.jsx), so the reader sees everything that goes before the press.
//
// `Send by email` IS LIVE WHATEVER THE FIELD HOLDS (ReportProblem.md:17,
// ReportProblemEmpty.md:5): the press commits nothing, it only hands the reader's
// own mail a prefilled draft through a `mailto:` link (ReportProblem.md:21).
//
// THE WORDS ARE KEPT by Back and by the handoff (ReportProblem.md:27,29); an
// empty field keeps nothing (ReportProblemEmpty.md:13).

import { useEffect, useState } from "react";

import { RUNNING_VERSION } from "@/lib/release/running-version";
import { deviceLabel } from "@/lib/session/device-label";
import { FactRow } from "@/lib/ui2/fact-row";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { PillButton } from "@/lib/ui2/pill-button";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { TextField } from "@/lib/ui2/text-field";

import {
  keepWords,
  readKeptWords,
  REPORT_ADDRESS,
  REPORT_FIELD_LABEL,
  REPORT_LEAD,
  REPORT_NOTE,
  REPORT_SEND,
  REPORT_TITLE,
  reportMailto,
  reportTime,
} from "./report-problem";

export function ReportProblemView({
  onBack,
  now = () => new Date(),
  userAgent,
  version = RUNNING_VERSION,
  openMail = (url) => {
    window.location.href = url;
  },
}: {
  /** The header's back arrow: the surface that opened the report returns (ReportProblem.md:27). */
  onBack: () => void;
  /** Test injection: the clock `Time` reads. */
  now?: () => Date;
  /** Test injection: what `Running on` is read from. */
  userAgent?: string;
  version?: string;
  /** Test injection: hands the draft to the reader's own mail. */
  openMail?: (url: string) => void;
}) {
  const [words, setWords] = useState("");
  const [runningOn, setRunningOn] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    // THE RULE IS DISABLED DELIBERATELY: the kept words, the browser and the
    // clock are this device's, which the server render cannot read, so they
    // are read after hydration — React's documented pattern for content that
    // differs between server and client (react.dev, hydrateRoot, "Handling
    // different client and server content"), as the sign-in form reads its mark.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWords(readKeptWords());
    setRunningOn(deviceLabel(userAgent) ?? "");
    setTime(reportTime(now()));
    // Read once, on opening; the clock is read again at the press.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const write = (next: string) => {
    setWords(next);
    keepWords(next);
  };

  const send = () => {
    // `Time` reads the moment of the press (ReportProblem.md:19).
    const pressed = reportTime(now());
    setTime(pressed);
    keepWords(words);
    openMail(reportMailto(words, { to: REPORT_ADDRESS, version, runningOn, time: pressed }));
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col" data-testid="reportProblem">
      <HeaderBar onBack={onBack} backLabel="Back" testId="reportProblem.header" />
      <div className="flex flex-col px-6 pb-8 pt-2">
        <h1 className="m-0 text-headline-small">{REPORT_TITLE}</h1>
        <p className="m-0 mt-2 text-body-medium text-on-surface-variant">{REPORT_LEAD}</p>

        <div className="mt-6">
          <TextField
            label={REPORT_FIELD_LABEL}
            value={words}
            onChange={write}
            multiline
            rows={4}
            testId="reportProblem.words"
          />
        </div>

        <div className="mt-6 flex flex-col" data-testid="reportProblem.facts">
          <FactRow label="To" value={REPORT_ADDRESS} />
          <FactRow label="Version" value={version} />
          <FactRow label="Running on" value={runningOn} />
          <FactRow label="Time" value={time} last />
        </div>

        <div className="mt-3">
          <QuietNote testId="reportProblem.note">{REPORT_NOTE}</QuietNote>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <PillButton testId="reportProblem.send" full onClick={send}>
            {REPORT_SEND}
          </PillButton>
        </div>
      </div>
    </main>
  );
}
