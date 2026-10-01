/* WHAT'S NEW — the release chronicle behind Settings' `What's new` row (the
   support stack, jakob 2026-10-01).

   THE SYSTEM'S CHRONICLE, APPLIED TO THE PRODUCT ITSELF (readme §13, *The
   change-histories round*): one list of whole versions, newest first, the
   current one marked in its own dateline rather than lifted above the list.
   A release is drawn the way a version is — a dateline, then the thing
   itself — and never as a diff against the one before.

   THE DATELINE SPEAKS THE AGES LAW: history is a date, `dd.mm.yyyy`, and the
   version is named whole. The marked one is the version running here, the
   same value the settings row reads, so the row and the page cannot disagree.

   EACH RELEASE'S NOTES ARE PLAIN WORDS about what a reader can now do, and
   each ends in its own door, `See it on GitHub`, onto that release's public
   page — the full notes and the code, at `RELEASES_URL` + `/tag/v<version>`
   on the public repo. The doors are named for their release,
   because three controls reading the same words a thumb apart tell a
   listener the verb and not the object (copy-voice, *The settings page*,
   `Copy the PEM block`'s rule). The words are platform-independent; the app
   and the web read one list.

   THE NOTES ARE FIXTURE, NOT COPY. What each release says is written when it
   ships; the board draws the shape a release's notes take.

   A TASK PAGE: the back arrow and no bottom bar, like every page Settings
   opens. */

const RELEASES = [
  {
    version: RUNNING_VERSION,
    date: "30.09.2026",
    current: true,
    notes: [
      "A reply says what it answers — a post by its title, a comment by its first words.",
      "While something signs, the button says what it's doing, and a signing that doesn't go through says so right where you were.",
    ],
  },
  {
    version: "0.1.1",
    date: "28.09.2026",
    notes: [
      "Comments, profiles and tags can join your feed — turn them on in the filter.",
      "A tag you type is always the first row, ready to add.",
    ],
  },
  {
    version: "0.1.0",
    date: "25.09.2026",
    notes: ["The first release: posts and comments, opinions, tags and citations, invites, and a key that is yours alone."],
  },
];

function Release({ version, date, current = false, notes }) {
  return (
    <>
      <SectionLabel>{current ? `Version ${version} · current · ${date}` : `Version ${version} · ${date}`}</SectionLabel>
      <div style={{ padding: "0 16px" }}>
        <Card>
          {notes.map((line) => (
            <p
              key={line}
              style={{
                margin: 0,
                fontSize: "var(--text-body-medium)",
                lineHeight: "var(--text-body-medium--line-height)",
                letterSpacing: "var(--text-body-medium--letter-spacing)",
              }}
            >
              {line}
            </p>
          ))}
          <InlineAction selfStart ariaLabel={`See version ${version} on GitHub`} onClick={() => {}}>
            See it on GitHub
          </InlineAction>
        </Card>
      </div>
    </>
  );
}

export function Screen() {
  return (
    <>
      <PageHeader title="What's new" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 0 16px" }}>
        {RELEASES.map((release) => (
          <Release key={release.version} {...release} />
        ))}
        <div style={{ padding: "16px 24px 0" }}>
          <QuietNote>Newest first. Every release's full notes and its code are public on GitHub.</QuietNote>
        </div>
      </div>
    </>
  );
}
