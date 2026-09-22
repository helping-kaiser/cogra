/* THE POST-MVP TREE'S OWN PRELUDE. `render-screens.mjs` prepends this file to
   every board in this tree, the way canonical's `_shared.jsx` is prepended to
   its own: screen-level layout that is not a design-system component lives
   here once.

   IT HOLDS LAYOUT, AND THE COPY MORE THAN ONE BOARD READS. A line of blessed
   copy exists in exactly one place in this tree — which is what the rule is
   for, and why a chronicle four boards draw lives here rather than four times
   over. Canonical's own prelude settled this shape (`ThreadDetail`: a body on a
   second screen stops being screen-local); what a single board says stays on
   that board. The column shapes are here for the same reason — the settings
   page's body, the notification list's and the chronicle's are each the shape
   canonical draws, because a post-MVP board that sat in a different column
   would be showing a different app.

   THE SETTINGS BOARDS ARE EXCERPTS, and `SettingsExcerpt` is what says so.
   Canonical's `SettingsBody` is the whole page and the master; a copy of it
   here would drift from that master the first time a canonical group moved.
   So a board in this tree draws the groups its ruling is about and the groups
   on either side of them, which is what pins a placement, and nothing else.

   THE DESTRUCTURE NAMES WHAT THIS TREE USES, not everything the bundle exposes:
   a board reaches a design-system master by its bare name, and this is where
   that name comes from. */

const {
  PageHeader,
  BottomNav,
  ALL_SLOTS,
  SettingsGroup,
  SettingsRow,
  ContentRow,
  QuietNote,
  InlineAction,
  Icon,
  PostCard,
  CommentCard,
  OverflowMenu,
  MonogramAvatar,
  ActorChip,
  EditedMarker,
  SectionLabel,
  Card,
  Button,
  DialogSurface,
  BottomSheet,
  SheetItem,
  SheetTitle,
  StanceRow,
  StanceValue,
  StanceControl,
  HISTORY_DOOR_LABEL,
  SEVERED_LABEL,
  SR_ONLY,
  TabBar,
} = components;

function SettingsExcerpt({ children }) {
  return (
    <>
      <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "24px 24px 32px" }}>
        {children}
      </div>
    </>
  );
}

function ChronicleList({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px 0" }}>
      {children}
    </div>
  );
}

/* ══ THE CHANGE-HISTORIES ROUND ══════════════════════════════════════════════

   EVERY VERSION WHOLE, NEWEST FIRST, AND NEVER A DIFF (jakob's rulings
   2026-09-22). The store keeps complete states — on L1 an edit signs a full new
   record of its own, pointing at unchanged media — so a difference between two
   versions is something a reader works out by reading, never something the
   product computes and presents. Two highlighted words would also be a claim
   about which change mattered, which is the author's business and not ours.

   A TOMBSTONED VERSION KEEPS ITS ROW. Removal takes the payload, never the
   record (erasure.md §1), so the row stands with the mark in the content's
   place — the same mark a removed post wears whole, at version scale. */

const SOL = { handle: "sol", displayName: "Sol Ferreira" };
const MIRA = { handle: "mira", displayName: "Mira Voss" };

/* THE ONE LAW EVERY CHRONICLE CLOSES ON. Three boards draw it, so it is written
   once: a reader who learns it on a post's history should meet the same
   sentence under a comment's and a profile's. */
const CHRONICLE_FOOTNOTE =
  "Every version is its own signed record. Editing adds a new one on top — nothing is rewritten, and removing one leaves a mark in its place.";

/* The post four boards are the history OF — the chronicle, its own detail, the
   author's register and the confirm over it. Its subject is a durable one on
   purpose: a post about tomorrow's tide, edited over nine days, would have the
   reader reading the dates as a mistake rather than as the point. */
const SALT_MAPS_CURRENT = {
  author: SOL,
  content:
    "Salt maps of the coast road — the rubbings are up at the harbour office until the end of the month. Paper against the salt crust, the side of a wax stick, and whatever the wind allowed.",
  topics: ["fieldnotes", "saltmaps"],
};

const SALT_MAPS_EARLIER = {
  author: SOL,
  content: "Salt maps of the coast road — the rubbings are up at the harbour office. Paper against the salt crust and the side of a wax stick.",
  topics: ["fieldnotes"],
};

const SALT_MAPS_TOMBSTONE = {
  author: SOL,
  redacted: {
    reason: "author",
    note: "A version stood here from 3 September. Its words and pictures were removed; the record of the change stays.",
  },
};

/* The chronicle column. The labels carry the screen's gutter themselves
   (`SectionLabel`'s own rule) and the cards carry theirs, so a label sits with
   the version it opens rather than between two of them. */
function HistoryColumn({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 0 16px" }}>{children}</div>
  );
}

/* One version: the line that dates it, whatever act the author may take on it,
   and the version itself drawn by its own master. */
function VersionBlock({ label, action, children }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingRight: 16 }}>
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      <div style={{ padding: "0 16px" }}>{children}</div>
    </>
  );
}

function ChronicleFootnote({ children }) {
  return <div style={{ padding: "16px 16px 0" }}><QuietNote>{children}</QuietNote></div>;
}

/* A VERSION CARD CARRIES NO AFFORDANCES, and that is a ruling the card makes
   for itself: the opinion, the score and the comment count belong to the POST,
   and a chronicle drawing them three times would be drawing one fact three
   times. What a version card has is what the author signed — the words, the
   topics, and the author's own chip — plus the way into that version's detail. */
function PostVersionCard({ version, href }) {
  return <PostCard {...version} variant="summary" showStance={false} href={href} onOpen={() => {}} />;
}

/* THE CHRONICLE, DRAWN ONCE FOR BOTH ITS READERS (canonical's `ThreadDetail`
   rule — a body on a second screen stops being screen-local). The author's
   register is the same list with two things added, never a second list: the
   whole-post removal leading it, and one act per earlier version.

   THE WHOLE-POST REMOVAL LEADS, AND IT IS THE POINT OF THE REGISTER. Left to
   per-version acts alone, an author who wanted a post gone would remove version
   after version and still leave the head standing — the head never falls
   through to a predecessor (erasure.md §1). So the act that does what they
   actually mean is the first thing on the page. */
function PostChronicle({ own = false }) {
  return (
    <HistoryColumn>
      {own && (
        <div style={{ padding: "12px 16px 4px" }}>
          <Card>
            <Button variant="text" selfStart>
              Remove the whole post
            </Button>
            <QuietNote>Removes every version at once. Removing a single version leaves the rest standing.</QuietNote>
          </Card>
        </div>
      )}
      <VersionBlock label="Current version · signed 12 September">
        <PostVersionCard version={SALT_MAPS_CURRENT} href="/p/salt-maps/v/12-september" />
      </VersionBlock>
      <VersionBlock
        label="Earlier version · signed 8 September"
        action={own ? <InlineAction size="sm">Remove this version</InlineAction> : undefined}
      >
        <PostVersionCard version={SALT_MAPS_EARLIER} href="/p/salt-maps/v/8-september" />
      </VersionBlock>
      {/* NO ACT ON A TOMBSTONE. Its payload is already gone, and an act that
          could only repeat itself is an act that teaches the reader nothing. */}
      <VersionBlock label="Earlier version · signed 3 September">
        <PostCard {...SALT_MAPS_TOMBSTONE} variant="summary" showStance={false} />
      </VersionBlock>
      <ChronicleFootnote>{CHRONICLE_FOOTNOTE}</ChronicleFootnote>
    </HistoryColumn>
  );
}

/* The own post's menu, this tree's copy of canonical's `OWN_POST_MENU` with the
   round's row joined beside Edit — the excerpt pattern, so canonical's own
   roster is untouched until this round migrates. */
const OWN_POST_MENU = [
  { label: "Save", onSelect: () => {} },
  { label: "Cite in a new post", onSelect: () => {} },
  { label: "Edit", onSelect: () => {} },
  { label: "Edit history", onSelect: () => {} },
  { label: "Mark as sensitive", onSelect: () => {} },
  { label: "Remove", onSelect: () => {} },
  { label: "License terms", onSelect: () => {} },
];

/* The detail surface's header and column — canonical's shapes, spelled here
   because a tree does not reach another tree's screens. */
function DetailHeader({ items }) {
  return <PageHeader backHref="#" backLabel="Back to feed" action={<OverflowMenu items={items} ariaLabel="More on this post" />} />;
}

function DetailColumn({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, padding: "0 0 8px 0" }}>
      {children}
    </div>
  );
}

/* A PROFILE VERSION — the identity band at chronicle scale.

   IT IS NOT `ProfileHeader`. That master is the top of a LIVE profile: it
   carries the figures row and the actions row, and an opinion is given on the
   PERSON, never on the version of their profile that stood in July. Three
   headers stacked would offer three opinion controls for one opinion and three
   Message buttons for one person. What a version is, is what the author signed
   — the face, the name, the words and the address — so that is what the card
   holds, and every one of those is drawn by the master that owns it.

   THE ADDRESS IS NOT A LINK HERE. It is what stood at that date, not a place
   this page sends anybody; a coloured, pressable string would promise a
   destination the version cannot vouch for. */
function ProfileVersionCard({ displayName, handle, avatarSrc, bio, website }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <MonogramAvatar name={displayName} src={avatarSrc} size="lg" />
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>{displayName}</span>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>@{handle}</span>
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{bio}</p>
      <span style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>{website}</span>
    </Card>
  );
}

/* THE HISTORIC BANNER IS A NOTE, NOT A WARNING. A reader who opened a version
   from its chronicle knows where they are; the line exists for the one who
   arrived by link, and for the one who scrolled far enough to forget. So it
   takes `QuietNote`'s register on the ground a kept space wears
   (`RedactedContent`'s own), with the way back out riding its end — and no
   error colour, because nothing here went wrong. */
function HistoricNote({ line, action }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-2)",
        margin: "0 16px",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-container-high)",
      }}
    >
      <QuietNote>{line}</QuietNote>
      <InlineAction size="sm">{action}</InlineAction>
    </div>
  );
}

/* ── THE STANCE TIMELINES ────────────────────────────────────────────────────

   A STANCE IS ALREADY A HISTORY. The bundle from one node to another is not a
   stored number that gets overwritten — it is every record ever cast along that
   pair, folded. So this timeline reads the record mirror and adds no table:
   the list IS the thing, and the standing is what it comes to.

   AND THE FOLD CLIPS, WHICH IS WHY THE PLAIN-WORDS LINE EXISTS. A raw sum of
   +27.40 lands at +1.00 the moment it passes the cap, so two people whose
   standings read identically can be one gentle pick and twenty-seven apart. The
   dial cannot show that and should not try; a sentence can, so the header says
   it in words and leaves the digits to geek mode.

   NUMBERS RIDE THE READING MODE, NEVER A SEPARATE BOARD. Both markups are
   always drawn — the face for everybody, the exact pair in a `cg-exact` span
   that paints only in geek mode — and the spoken twin says the fact in both, so
   the mode draws and never redacts (readme §13). */

/* The numbers in a sentence — canonical's `ExactTail`, spelled here because a
   tree does not reach another tree's prelude. */
function ExactTail({ exact, spoken }) {
  return (
    <>
      <span className="cg-exact" aria-hidden="true">{exact}</span>
      <span style={SR_ONLY}>{spoken}</span>
    </>
  );
}

/* One record: the face it was cast at, the date it was signed, and — for the
   one record that is a counter-record — the word for what it did. The face and
   the pair come from `StanceValue`, so a board never spells a readout and can
   never drift from the anchor table. */
function TimelineRow({ pDirected, pInterest, when, note }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "6px 24px" }}>
      <StanceValue pDirected={pDirected} pInterest={pInterest} />
      {note && (
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
          {note}
        </span>
      )}
      <span style={{ flex: 1 }} />
      <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
        {when}
      </span>
    </div>
  );
}

/* The header: what it stands at, and what it is built from. The label is the
   pad's own word for the same quantity, so a reader who taps through from the
   pad meets the line they just left. */
function TimelineHeader({ pDirected, pInterest, sum, exact, spoken }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", padding: "0 24px 8px" }}>
      <span
        aria-hidden="true"
        style={{
          fontSize: "var(--text-label-small)",
          letterSpacing: "var(--text-label-small--letter-spacing)",
          fontWeight: "var(--text-label-small--font-weight)",
          color: "var(--text-secondary)",
        }}
      >
        As it stands
      </span>
      <StanceValue pDirected={pDirected} pInterest={pInterest} />
      <p style={{ margin: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
        {sum} <ExactTail exact={exact} spoken={spoken} />
      </p>
    </div>
  );
}

function TimelineSheet({ title, ariaLabel, children }) {
  return (
    <BottomSheet open ariaLabel={ariaLabel} maxHeight="88%">
      <SheetTitle>{title}</SheetTitle>
      {children}
    </BottomSheet>
  );
}

/* A PERSON↔PERSON BUNDLE: six of twenty-seven, because a sheet scrolls and a
   board shows the top of a list rather than all of it. Three years of dates is
   what makes the header's sentence worth drawing — a relationship is the case
   where a clipped sum hides the most.

   THE COUNTER-RECORD IS IN THE FIXTURE ON PURPOSE. Walking an opinion back
   signs a record like any other, so it stands at its own date wearing the
   system's own word; a timeline that hid it would be telling the one lie this
   surface exists to prevent, and the picks under it would look unanswered. */
const TIMELINE_RECORDS = [
  { pDirected: 0.9, pInterest: 0.6, when: "12 September" },
  { pDirected: 1, pInterest: 1, when: "3 August" },
  { pDirected: -1, pInterest: -1, when: "14 May", note: SEVERED_LABEL },
  { pDirected: 0.8, pInterest: 0.4, when: "2 February" },
  { pDirected: 0.6, pInterest: 0.3, when: "9 November 2024" },
  { pDirected: 0.4, pInterest: 0.1, when: "21 June 2024" },
];

/* A PERSON→POST BUNDLE, WHOLE. A post that went up on 3 September cannot carry
   a record from 2024, so the content-side fixture is its own: four picks in ten
   days, every one of them drawn, and a raw sum the board's own rows add up to.
   Its header's numbers are checkable by hand against these four. */
const POST_TIMELINE_RECORDS = [
  { pDirected: 0.9, pInterest: 0.6, when: "12 September" },
  { pDirected: 0.5, pInterest: 0.3, when: "10 September" },
  { pDirected: 0.7, pInterest: 0.4, when: "7 September" },
  { pDirected: 0.3, pInterest: 0.2, when: "5 September" },
];

function TimelineRecords({ records = TIMELINE_RECORDS }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {records.map((record) => (
        <TimelineRow key={record.when} {...record} />
      ))}
    </div>
  );
}

/* Who holds an opinion on the post the two post-side boards draw — canonical's
   own roster, at the length this sheet can show. */
const POST_OPINION_HOLDERS = [
  { name: "Mira Voss", handle: "mira", src: "inviter.jpg", pDirected: 0.9, pInterest: 0.25 },
  { name: "Sol Ferreira", handle: "sol", pDirected: 0.7, pInterest: 0.4 },
  { name: "Tobias Lindqvist", handle: "tobias", pDirected: 0.6, pInterest: 0.65 },
  { name: "Kel Moreau", handle: "kel", pDirected: 0.25, pInterest: 0.95 },
  { name: "Juno Baptiste", handle: "juno", pDirected: -0.55, pInterest: 0.25 },
];

/* The post the opinion boards are about, and the surface its sheets sit over. */
function OpinionPostDetail() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to feed" />
      <DetailColumn>
        <PostCard {...SALT_MAPS_CURRENT} timestamp="12 September" variant="detail" score="9.10" comments={2} opinions={5} onOpenOpinions={() => {}} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

/* The profile opinions page — canonical's `ProfileStances`, drawn here so the
   round's split rows can be shown on it without touching the MVP board. */
function ProfileStancesExcerpt({ onOpenHistory }) {
  return (
    <>
      <PageHeader title="@ada · Opinions" backHref="#" backLabel="Back" />
      <TabBar
        ariaLabel="Which direction"
        value="on"
        tabs={[
          { id: "on", label: "On them" },
          { id: "taken", label: "By them" },
        ]}
      />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingTop: 4 }}>
        <StanceRow name="Tobias Lindqvist" handle="tobias" pDirected={0.7} pInterest={0.4} onOpen={() => {}} onOpenHistory={onOpenHistory} />
        <StanceRow name="Sol Ferreira" handle="sol" pDirected={0.6} pInterest={0.3} onOpen={() => {}} onOpenHistory={onOpenHistory} />
        <StanceRow name="Mira Voss" handle="mira" src="inviter.jpg" pDirected={0.4} pInterest={0.5} onOpen={() => {}} onOpenHistory={onOpenHistory} />
        <StanceRow name="Juno Baptiste" handle="juno" pDirected={-0.2} pInterest={0.1} onOpen={() => {}} onOpenHistory={onOpenHistory} />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
