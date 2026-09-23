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
  RedactedContent,
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

/* The post the chronicle boards are the history OF — the chronicle, its two
   detail surfaces, the author's register and the confirm over it. Its subject is
   a durable one on purpose: a post about tomorrow's tide, edited over nine days,
   would have the reader reading the dates as a mistake rather than as the point.

   A VERSION IS THE CONTENT STATE, AND NOTHING ELSE (jakob's ruling on the canvas
   review, 2026-09-23): title, description, body, media and the sensitive mark —
   the columns `post_versions` keeps. ADDING OR REMOVING A TAG OR A REFERENCE IS
   NOT AN EDIT. Each is a standalone edge pointing at the post, signed on its own;
   the edit screen merely gathers them beside the words. So no version in this
   fixture differs from another by a tag, and every version card wears the SAME
   tags line — the post's current tags, which are facts about the post rather
   than about any one of its versions.

   AND THE BODY'S KIND CAN CHANGE BETWEEN VERSIONS. A post's body is words XOR
   media, per version, so a chronicle has to draw both kinds side by side: the
   5 September version was a picture — the MVP tree's own salt-maps post, one
   frame of it — and the author rewrote it as words three days later. */
const SALT_MAPS_TOPICS = ["fieldnotes", "saltmaps"];

const SALT_MAPS_CURRENT = {
  author: SOL,
  content:
    "Salt maps of the coast road — the rubbings are up at the harbour office until the end of the month. Paper against the salt crust, the side of a wax stick, and whatever the wind allowed.",
  topics: SALT_MAPS_TOPICS,
};

const SALT_MAPS_EARLIER = {
  author: SOL,
  content: "Salt maps of the coast road — the rubbings are up at the harbour office. Paper against the salt crust and the side of a wax stick.",
  topics: SALT_MAPS_TOPICS,
};

/* The picture version: canonical's `SOL_POST` words and crop, one frame. */
const SALT_MAPS_PICTURE = {
  author: SOL,
  title: "Salt maps of the coast road",
  description:
    "Rubbings from three weekends at low tide — paper against the salt crust, the side of a wax stick, and whatever the wind allowed.",
  media: [{ src: "post-photo.jpg", ratio: "square", fit: "cover" }],
  topics: SALT_MAPS_TOPICS,
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
   and the version itself drawn by its own master. The act sits on the label's
   BASELINE — both are `label-small`, and the label carries its own asymmetric
   padding, so aligning the boxes' bottoms would drop the act 4px under the
   words it ends.

   THE ROW TAKES NO GAP OF ITS OWN: the label's own 24px right gutter is the
   space between the two. The longest dateline the chronicle can print —
   `Current version · signed 12 September`, September being the longest month —
   measures 208px of text, and with its gutters, the 109px act and the row's
   16px edge it comes to 381 of the 390; a 12px gap on top overran the frame and
   folded both the dateline and the act onto two lines. */
function VersionBlock({ label, action, children }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingRight: 16 }}>
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      <div style={{ padding: "0 16px" }}>{children}</div>
    </>
  );
}

/* THE AUTHOR'S ACT ON ONE VERSION, AND WHAT STANDS IN ITS SLOT ONCE IT IS SPENT
   (jakob's ruling on the canvas review, 2026-09-23). Every version with a
   payload carries `Remove this version` — the CURRENT one included: removing
   the head leaves the older versions standing and the post rendering removed,
   the no-fallback rule `VersionRemoveConfirm` already words. A tombstoned
   version's slot does not go empty, because an empty slot on one row of a
   register reads as an act that forgot to draw; it carries the quiet word
   `Already removed` — `PickedSheet`'s "Described" idiom, a finished act's word
   in `text-secondary`, not pressable, standing exactly where the act would. */
function RemoveVersionAct() {
  return (
    <InlineAction size="sm" style={{ flex: "none" }}>
      Remove this version
    </InlineAction>
  );
}

function AlreadyRemoved() {
  return (
    <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
      Already removed
    </span>
  );
}

/* THE LEAD OF EVERY AUTHOR'S REGISTER — the act that does what an author who
   wants the thing gone actually means, with the line that says what the
   per-version act does instead. One shape for the post, the comment and the
   profile; only the words change with the kind. */
function RegisterLead({ action, note }) {
  return (
    <div style={{ padding: "12px 16px 4px" }}>
      <Card>
        <Button variant="text" selfStart>
          {action}
        </Button>
        <QuietNote>{note}</QuietNote>
      </Card>
    </div>
  );
}

const REMOVE_ONE_LEAVES_THE_REST = "Removes every version at once. Removing a single version leaves the rest standing.";

function ChronicleFootnote({ children }) {
  return <div style={{ padding: "16px 16px 0" }}><QuietNote>{children}</QuietNote></div>;
}

/* A VERSION CARD CARRIES NO AFFORDANCES, and that is a ruling the card makes
   for itself: the opinion, the score and the comment count belong to the POST,
   and a chronicle drawing them three times would be drawing one fact three
   times. What a version card has is what the author signed in it — the words or
   the picture, and the author's own chip — plus the way into that version's
   detail. Its tags line is the post's CURRENT tags, identical on every card:
   a tag is its own edge onto the post, never part of a version. */
function PostVersionCard({ version, href }) {
  return <PostCard {...version} variant="summary" showStance={false} href={href} onOpen={() => {}} />;
}

/* THE CHRONICLE, DRAWN ONCE FOR BOTH ITS READERS (canonical's `ThreadDetail`
   rule — a body on a second screen stops being screen-local). The author's
   register is the same list with two things added, never a second list: the
   whole-post removal leading it, and one act on every version that still has a
   payload.

   THE WHOLE-POST REMOVAL LEADS, AND IT IS THE POINT OF THE REGISTER. Left to
   per-version acts alone, an author who wanted a post gone would remove version
   after version and still leave the head standing — the head never falls
   through to a predecessor (erasure.md §1). So the act that does what they
   actually mean is the first thing on the page.

   ANY KIND OF VERSION, ONE LIST. The picture version is drawn by the same
   master at the same variant as the words around it — the card re-proportions
   for a picture the way it does in the feed — so a reader meets a change of
   kind as one more version, never as a different sort of row. */
function PostChronicle({ own = false }) {
  const act = own ? <RemoveVersionAct /> : undefined;
  return (
    <HistoryColumn>
      {own && <RegisterLead action="Remove the whole post" note={REMOVE_ONE_LEAVES_THE_REST} />}
      <VersionBlock label="Current version · signed 12 September" action={act}>
        <PostVersionCard version={SALT_MAPS_CURRENT} href="/p/salt-maps/v/12-september" />
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 8 September" action={act}>
        <PostVersionCard version={SALT_MAPS_EARLIER} href="/p/salt-maps/v/8-september" />
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 5 September" action={act}>
        <PostVersionCard version={SALT_MAPS_PICTURE} href="/p/salt-maps/v/5-september" />
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 3 September" action={own ? <AlreadyRemoved /> : undefined}>
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

/* A REMOVED PROFILE VERSION — the post's tombstone at profile scale. The name,
   the words, the face and the address were the version's payload, so all four
   go and the mark stands in their place; what survives is what never rode a
   version — the handle, the account's own — beside the reserved disc a kept
   space wears (`MonogramAvatar`'s `redacted`). It is NOT the deleted-account
   treatment: the account stands, and the chip saying `Deleted account` would be
   a lie about it. */
function ProfileVersionTombstone({ handle, note }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <MonogramAvatar name={handle} size="lg" redacted />
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>@{handle}</span>
      </div>
      <RedactedContent reason="author" note={note} />
    </Card>
  );
}

/* ── THE COMMENT'S AND THE PROFILE'S CHRONICLES ─────────────────────────────

   Each drawn ONCE for both its readers, `PostChronicle`'s rule: the author's
   register is the same list with the acts joined, never a second list, so the
   reader's board and the author's can never disagree about which versions
   exist. The acts are the post's, word for word — the removal of the whole
   thing leading, `Remove this version` on every version that still has a
   payload, `Already removed` in a tombstone's slot.

   THE CONFIRM IS THE POST BOARD'S MASTER AT EACH SCALE. No comment or profile
   confirm is drawn: a per-version removal opens `VersionRemoveConfirm`'s dialog,
   and the lead's whole-thing removal opens the same anatomy — one think-twice
   shape for one kind of decision, whatever is being removed. */
const TOMBSTONE_NOTE = (date) => `A version stood here from ${date}. Its words and pictures were removed; the record of the change stays.`;

function CommentVersion({ children }) {
  return <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>{children}</ul>;
}

function CommentChronicle({ own = false }) {
  const act = own ? <RemoveVersionAct /> : undefined;
  return (
    <HistoryColumn>
      {own && <RegisterLead action="Remove the whole comment" note={REMOVE_ONE_LEAVES_THE_REST} />}
      <VersionBlock label="Current version · signed 12 September" action={act}>
        <CommentVersion>
          <CommentCard
            author={SOL}
            showStance={false}
            content="The third headland light is real — I have a print from 2019 that almost catches it. It is the bend that does it, not the light."
          />
        </CommentVersion>
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 8 September" action={act}>
        <CommentVersion>
          <CommentCard author={SOL} showStance={false} content="The third headland light is real — I have a print from 2019 that almost catches it." />
        </CommentVersion>
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 5 September" action={own ? <AlreadyRemoved /> : undefined}>
        <CommentVersion>
          <CommentCard author={SOL} showStance={false} redacted={{ reason: "author", note: TOMBSTONE_NOTE("5 September") }} />
        </CommentVersion>
      </VersionBlock>
      <ChronicleFootnote>{CHRONICLE_FOOTNOTE}</ChronicleFootnote>
    </HistoryColumn>
  );
}

/* THE PROFILE'S LEAD SAYS WHERE ITS EDGE IS (jakob's canvas review, 2026-09-23:
   "removing the contents of your profile is not deleting your account — you need
   to be able to do so"). A profile is the one kind whose removal a reader can
   mistake for leaving, so the footnote names what stays: the account, the handle
   and everything published under it. Account deletion is its own act, in
   settings, with its own seven days. */
const PROFILE_LEAD_NOTE =
  "Removes the contents of every profile version at once. Your account, your handle and everything you published stay — this only empties the profile's history.";

function ProfileChronicle({ own = false }) {
  const act = own ? <RemoveVersionAct /> : undefined;
  return (
    <HistoryColumn>
      {own && <RegisterLead action="Remove every version" note={PROFILE_LEAD_NOTE} />}
      <VersionBlock label="Current version · signed 12 September" action={act}>
        <ProfileVersionCard
          displayName="Mira Voss"
          handle="mira"
          avatarSrc="inviter.jpg"
          bio="Runs the stand by the sea wall — honey from the headland hives, and whatever the flats give up that morning."
          website="tidemarket.example"
        />
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 8 September" action={act}>
        <ProfileVersionCard displayName="Mira Voss" handle="mira" bio="Runs the stand by the sea wall — honey from the headland hives." website="tidemarket.example" />
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 3 September" action={act}>
        <ProfileVersionCard displayName="M. Voss" handle="mira" bio="Beekeeper. Market on Sundays." website="voss.example" />
      </VersionBlock>
      <VersionBlock label="Earlier version · signed 20 August" action={own ? <AlreadyRemoved /> : undefined}>
        <ProfileVersionTombstone
          handle="mira"
          note="A version stood here from 20 August. Its name, words, picture and address were removed; the record of the change stays."
        />
      </VersionBlock>
      <ChronicleFootnote>{CHRONICLE_FOOTNOTE}</ChronicleFootnote>
    </HistoryColumn>
  );
}

/* THE HISTORIC BANNER — the tree's own notice panel, drawn the way the
   key-absent notice is (jakob's canvas review, 2026-09-23: the first drawing
   butted straight onto the card and read as the card's own header).

   IT IS A PANEL OF ITS OWN, ON ITS OWN SURFACE. `tertiary-container` with its
   `on-` pair, the card's medium rung, the card's 16px padding and 12px inner
   gap — `WalletKeyAbsent`'s anatomy, the one notice panel canonical draws — and
   that notice's placement rule, "inset to the same margins as every card": on
   the detail surface the card runs the column's full width, so the panel does
   too, and the two read as one column of surfaces. The column's own 12px gap is what stands
   between it and the card, so the two never touch and never share a colour:
   the panel sits a tonal family away from the card's `surface-card`, which is
   what tells a reader it is a statement ABOUT the post rather than part of it.

   IT IS A NOTE, NOT A WARNING. The line is `body-medium` in the panel's own ink
   — no error colour, no icon — because nothing here went wrong. The way back to
   the current version owns its line under it, so it is a `Button` rather than a
   word riding the sentence (`InlineAction`'s own test), and on a tonal panel the
   filled button is `inverse`: the panel's pair turned over, one colour family.
   Small, and left-aligned — it is the way out, not the point. */
function HistoricNote({ line, action }) {
  return (
    <div style={{ paddingTop: 4 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--card-gap)",
          borderRadius: "var(--radius-medium)",
          background: "var(--tertiary-container)",
          color: "var(--on-tertiary-container)",
          padding: "var(--card-padding)",
        }}
      >
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{line}</p>
        <Button variant="inverse" size="sm" selfStart>
          {action}
        </Button>
      </div>
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
