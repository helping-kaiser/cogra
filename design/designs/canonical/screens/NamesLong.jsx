/* NAMES · WHEN THEY ARE LONG — the pattern board (round 40, jakob 2026-11-11:
   "long name rule seems fine. i just dont want ugly wrapping in places where
   it breaks the design"). The three cases of the long-name law, each drawn on
   the masters that carry it, at the longest legal handle — `@` and 30
   characters — and a 50-character display name, `name` choosing one with
   spaces or one unbroken. Every sentence is a drawn one with the long sample
   substituted: Notifications' first row, the chronicle's opinion act,
   `Hide @ada`, `ApplicantWaiting`'s card, `ChangeHandleConfirm`'s dialog,
   `FeedHidden`'s snackbar, the borrowed-view band's default line, a card's
   author chip and `SettingsHidden`'s row — and since round 48 (seam
   320-12) an opinion's row (`StanceRow`), the person card's lead and the
   reel's caption among the one-line places, `VouchBack`'s card among the
   wrapping text.

   1. PERSON ROWS (`person-row`): the actor chip's law, unchanged — the row
      never wraps, the name ellipsizes first, the handle stays whole until it
      alone cannot fit.
   2. ONE-LINE PLACES (`one-line`): a page title, a row's title and its
      aside, a menu row — the line never wraps; the handle is what is cut with
      "…", the words around it keep their room (`nameInLine`).
   3. TEXT THAT WRAPS (`wraps`): a card's title and body, a dialog, a
      snackbar, the band — the sentence wraps at its spaces and is never cut;
      a handle or name is one unit that never stands on two lines, moving
      whole to the next line and cut at its end with "…" only when longer
      than a line, its punctuation kept beside it (`nameInText`).

   A pattern exemplar: every control on it is its own board's, wired there,
   so the board is scan-exempt and registers nothing. */
const LONG_HANDLE = "maximiliana_featherstone_haugh";
const LONG_NAMES = {
  spaced: "Max Wilhelmina Featherstonehaugh Okonkwo-Lindqvist",
  unbroken: "MaximilianaWilhelminaFeatherstonehaughOkonkwoLiang",
};
export const PROPS = {
  case: { editor: "enum", options: ["one-line", "wraps", "person-row"], default: "one-line" },
  name: { editor: "enum", options: ["spaced", "unbroken"], default: "spaced" },
};
export const VALS = `oneLineShown: this.props.case === "one-line" ? "flex" : "none", wrapsShown: this.props.case === "wraps" ? "flex" : "none", personShown: this.props.case === "person-row" ? "flex" : "none", spacedShown: this.props.name === "unbroken" ? "none" : "flex", unbrokenShown: this.props.name === "unbroken" ? "flex" : "none"`;

const H = "@" + LONG_HANDLE;
const COLUMN = { flexDirection: "column", gap: 12, padding: "8px 16px 0" };

function PersonRows({ name }) {
  return (
    <>
      <Card style={{ flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ display: "flex", flex: 1, minWidth: 0 }}>
            <ActorChip handle={LONG_HANDLE} displayName={name} />
          </span>
          <span style={{ flex: "none", fontSize: "var(--text-label-small)", letterSpacing: "var(--text-label-small--letter-spacing)", fontWeight: "var(--text-label-small--font-weight)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>35m</span>
        </div>
      </Card>
      <ContentRow
        variant="chronicle"
        inert
        chevron={false}
        name={name}
        title={name}
        titleAside={H}
        second="Hidden 3d"
        trailing={<InlineAction onClick={() => {}}>Unhide</InlineAction>}
      />
    </>
  );
}

export function Screen() {
  return (
    <>
      <div style={{ display: "{{oneLineShown}}", flex: 1, flexDirection: "column" }}>
        <PageHeader title={H} backHref="#" backLabel="Back to feed" />
        <div style={{ display: "flex", ...COLUMN }}>
          <ContentRow
            variant="chronicle"
            chevron={false}
            unread
            name={LONG_NAMES.spaced}
            title={`${H} commented on your post`}
            second="The third headland light is real — I have a print from 2019 that almost catches it."
            trailing="35m"
            onOpen={() => {}}
          />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.4, pInterest: 0.5 }} title="Gave an opinion" titleAside={`on ${H}`} trailing="5d" inert />
          <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--radius-medium)", background: "var(--surface-dialog)", padding: "var(--space-2) 0" }}>
            <SheetItem label="Save" />
            <SheetItem label={`Hide ${H}`} />
          </div>
          {/* Round 48 (seam 320-12): an opinion's row, the person card's lead
              and the reel's caption, each line clipped at its end. */}
          <StanceRow name={LONG_NAMES.spaced} handle={LONG_HANDLE} pDirected={0.7} pInterest={0.4} />
          <ProfileFeedCard person={{ id: "8d3f2a1c-6b4e-4f7a-9c2d-1e5f6a7b8c9d", handle: LONG_HANDLE, displayName: LONG_NAMES.spaced }} bio="Runs the stand by the sea wall — honey from the headland hives." score="11.70" />
          <div style={{ position: "relative", flex: "none", height: 64, borderRadius: "var(--radius-medium)", background: "#000", overflow: "hidden" }}>
            <ReelCaption handle={LONG_HANDLE} title="Low tide at the third headland" bottom={8} />
          </div>
        </div>
      </div>
      <div style={{ display: "{{wrapsShown}}", flex: 1, ...COLUMN }}>
        <BorrowedViewBand handle={LONG_HANDLE} displayName={LONG_NAMES.spaced} />
        <TaskCard title={`All set — waiting on ${H}`} body="Their approval brings you in." />
        <DialogSurface
          inline
          title={`Change your handle to ${H}?`}
          body={`Links to ${H} stop working the moment it changes, and anyone can claim ${H} afterwards.`}
          actions={
            <>
              <Button variant="text">Change it</Button>
              <Button>Keep it</Button>
            </>
          }
        />
        <Snackbar inline message={`${H} is hidden.`} action="Undo" />
        {/* Round 48 (seam 320-12): the vouch card, its title and body naming
            the inviter. */}
        <VouchBackCard
          handle={LONG_HANDLE}
          body={`Vouch back to open the way from your side — your opinion toward ${H}, and your feed grows from it.`}
          actions={
            <Button variant="text" style={{ color: "var(--on-tertiary-container)" }}>
              Got it
            </Button>
          }
        />
      </div>
      <div style={{ display: "{{personShown}}", flex: 1, ...COLUMN }}>
        <div style={{ display: "{{spacedShown}}", flexDirection: "column", gap: 12 }}>
          <PersonRows name={LONG_NAMES.spaced} />
        </div>
        <div style={{ display: "{{unbrokenShown}}", flexDirection: "column", gap: 12 }}>
          <PersonRows name={LONG_NAMES.unbroken} />
        </div>
      </div>
    </>
  );
}
