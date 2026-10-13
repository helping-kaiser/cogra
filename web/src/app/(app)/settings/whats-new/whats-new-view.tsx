"use client";

// WHAT'S NEW — the release chronicle behind Settings' `What's new` row
// (WhatsNew.md, WhatsNewBehind.md; the release-registry packet §9). Whole
// releases, newest first, one card each, never a diff; each card ends in its
// release's public page. While the version running here is behind the newest
// release, one quiet line stands atop the list ending in `Update now`, which
// on the web reloads the page into the new version — never the GitHub page.
//
// The datelines say what each version is to this device: `installed` on the
// running one, `newest` on the head of the list only when behind, no word on
// the rest, never `current`. A running version the registry does not list is
// not behind and wears nothing (design ruling 61).
//
// DRIFT (release-registry slice C): geometry and tokens are rough until the
// surface-conformance pass; the loading state is a plain status line, and the
// back arrow returns to Settings at its top rather than at its About group
// (WhatsNew.md:21), as About CoGra's does.

import { useApolloClient } from "@apollo/client/react";
import { useEffect, useMemo, useState } from "react";

import { fetchReleases } from "@/lib/api/releases-api";
import type { Outcome } from "@/lib/api/outcome";
import { UPDATE_NOW } from "@/lib/release/newer-version-announcer";
import { RUNNING_VERSION } from "@/lib/release/running-version";
import {
  datelineText,
  datelineWord,
  releaseKey,
  versionStatus,
  type Release,
} from "@/lib/release/version-status";
import { BUTTON_CLASS } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { PageHeader } from "@/lib/ui/page-header";
import { TransportError } from "@/lib/ui/transport-error";
import { InlineAction } from "@/lib/ui2/inline-action";
import { QuietNote } from "@/lib/ui2/quiet-note";

export const NEWER_VERSION_LINE = "A newer version exists.";
export const NEWEST_FIRST = "Newest first.";

const NODE: DataNode = { path: "whatsNew" };

/** Nothing for the first 200 ms, then the loading line (design readme, the Loading law). */
const LOADING_DELAY_MS = 200;

type Read =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly releases: readonly Release[] };

export function WhatsNewView({
  load,
  running = RUNNING_VERSION,
  reload = () => window.location.reload(),
}: {
  /** Test injection: the registry read. */
  load?: () => Promise<Outcome<readonly Release[]>>;
  running?: string;
  /** `Update now` on the web (WhatsNewBehind.md:17). */
  reload?: () => void;
} = {}) {
  const client = useApolloClient();
  const read = useMemo(() => load ?? (() => fetchReleases(client)), [client, load]);
  const [state, setState] = useState<Read>({ kind: "loading" });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => setSlow(true), LOADING_DELAY_MS);
    void read().then((outcome) => {
      if (!live) return;
      setState(outcome.kind === "success" ? { kind: "ready", releases: outcome.value } : { kind: "failed" });
    });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [read]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col" {...testAttributes(NODE)}>
      <PageHeader
        title="What's new"
        backHref="/settings"
        backLabel="Back to settings"
        node={part(NODE, "header")}
      />
      <div className="flex flex-col pb-4">
        {state.kind === "loading" && slow && (
          <p role="status" className="m-0 px-6 pt-3 text-body-medium text-on-surface-variant">
            Loading…
          </p>
        )}
        {state.kind === "failed" && (
          <div className="px-6 pt-3">
            <TransportError testId="whats-new-error" />
          </div>
        )}
        {state.kind === "ready" && <Chronicle releases={state.releases} running={running} reload={reload} />}
      </div>
    </main>
  );
}

function Chronicle({
  releases,
  running,
  reload,
}: {
  releases: readonly Release[];
  running: string;
  reload: () => void;
}) {
  const status = versionStatus(releases, running);
  return (
    <>
      {status.newest !== null && (
        <p
          className="m-0 px-6 pt-2 text-body-medium text-on-surface-variant"
          {...testAttributes(part(NODE, "newerLine"))}
        >
          {NEWER_VERSION_LINE} <span aria-hidden="true">—</span>{" "}
          <InlineAction
            size="sm"
            ariaLabel={`Update to version ${status.newest.version}`}
            onClick={reload}
            node={part(NODE, "newerLine.update")}
          >
            {UPDATE_NOW}
          </InlineAction>
        </p>
      )}
      {releases.map((release, index) => {
        const key = releaseKey(release.version);
        const card = instance(NODE, "release", key);
        return (
          <section key={release.version} aria-label={`Version ${release.version}`}>
            <p
              className="m-0 px-6 pb-1 pt-3 text-label-small text-on-surface-variant"
              {...testAttributes(instance(NODE, "dateline", key))}
            >
              {datelineText(release, datelineWord(status, index))}
            </p>
            <div className="px-4">
              <Card node={card}>
                {release.notes.map((line, at) => (
                  <p key={at} className="m-0 text-body-medium">
                    {line}
                  </p>
                ))}
                {/* A control that navigates is a link (WAI-ARIA APG, Link
                    pattern): the release's public page, outside the app,
                    never the download (WhatsNew.md:15). */}
                <a
                  href={release.patchNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`See version ${release.version} on GitHub`}
                  {...testAttributes(part(card, "door"))}
                  className={`${BUTTON_CLASS} self-start text-label-large text-primary no-underline`}
                >
                  See it on GitHub
                </a>
              </Card>
            </div>
          </section>
        );
      })}
      <div className="px-6 pt-4">
        <QuietNote node={part(NODE, "footnote")}>{NEWEST_FIRST}</QuietNote>
      </div>
    </>
  );
}
