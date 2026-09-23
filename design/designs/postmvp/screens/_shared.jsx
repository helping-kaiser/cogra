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
  WashCard,
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
  HelpDot,
  TextField,
  MediaAttachment,
  ActsCard,
  FactRow,
  OwnStanceReadout,
  SealFooter,
  WizardHeader,
  WizardFooter,
  SearchBar,
  ReferenceRow,
  StagedReference,
  LICENSE_MENU_LABEL,
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

/* THE HISTORIC BANNER — the brand wash, not the account-notice olive
   (jakob's canvas review, 2026-09-23, second pass: `tertiary-container` is
   the register of system notices about YOUR ACCOUNT — the key-absent panel,
   the join-time prompts — and a history banner wearing it reads as the system
   talking. The surface he named instead is the wallet balance card's:
   "very nice cogra identity").

   SO IT IS `WashCard` — `--surface-hero`, the wash that dresses a page's ONE
   moment (the component's own charter), which is exactly what this banner is:
   the page's single statement that what stands below is a historic version.
   `ghost={false}`, because the oversized coin is money's identity and history
   is not money; `margin: 0`, because the detail column already carries the
   card margins and the wash must align with the card below it. The column's
   own 12px gap keeps the two surfaces apart, and the wash sits a family away
   from `surface-card`, which is what tells a reader the banner is a statement
   ABOUT the post rather than part of it.

   IT IS A NOTE, NOT A WARNING. The line is `body-medium` in the surface's own
   ink — no error colour, no icon — because nothing here went wrong. The way
   back to the current version owns its line under it, so it is a `Button`
   rather than a word riding the sentence (`InlineAction`'s own test); on the
   wash the ordinary filled button reads as every primary action does. Small,
   and left-aligned — it is the way out, not the point. */
function HistoricNote({ line, action }) {
  return (
    <div style={{ paddingTop: 4 }}>
      <WashCard ghost={false} style={{ margin: 0 }}>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{line}</p>
        <Button size="sm" selfStart>
          {action}
        </Button>
      </WashCard>
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
   pad meets the line they just left.

   THE SUM SENTENCE HAS RULES, for any count of picks and any span of time
   (`copy-voice.md`, the change-histories round): `Built from {N} picks
   {period}` — `in` days or weeks under a month, `over` months or years from a
   month on — with ` — more weight than the dial can show` only when the raw sum
   passes the dial on either axis, and a `cg-exact` tail reading `before the
   cap` when it clipped and `summed` when it did not. One pick is its own line.
   The boards pass the finished strings; the rules are what they are checked
   against. */
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

/* THE TIMELINE EARNS ITS ONE "?" (jakob's canvas review, 2026-09-23). What a
   reader cannot guess here is the thing the sheet exists to show — that an
   opinion is a sum of every signed pick, that the sum keeps counting past the
   dial, and that walking back is one more record rather than a deletion. That
   is a "?" by the system's own test: the explanation is too long for a caption
   and the reader who wants it is a different reader from the one who does not.

   IT RIDES THE SHEET TITLE'S OWN ROW, `SheetTitle`'s `trailing` slot — "top-right
   of the header or of the sheet it explains" — the way the filter sheet carries
   its own, and it is named by the dialog it opens (`How opinions build`). Both
   timelines carry it, because it explains the sheet rather than either target. */
function TimelineSheet({ title, ariaLabel, children }) {
  return (
    <BottomSheet open ariaLabel={ariaLabel} maxHeight="88%">
      <SheetTitle trailing={<HelpDot ariaLabel="How opinions build" />}>{title}</SheetTitle>
      {children}
    </BottomSheet>
  );
}

/* The person↔person timeline, whole — drawn once because two boards draw it:
   the timeline itself and the "?" dialog over it (`HelpDialog`'s rule: what a
   modal covers is the real surface, inert, never a stand-in). */
function PersonTimeline() {
  return (
    <>
      <ProfileStancesExcerpt onOpenHistory={() => {}} />
      <TimelineSheet title="@tobias on @ada" ariaLabel="Every opinion @tobias has signed on @ada">
        <TimelineHeader
          pDirected={1}
          pInterest={1}
          sum="Built from 27 picks over three years — more weight than the dial can show."
          exact="+27.40 / +26.10 before the cap"
          spoken="Raw sum before the cap: For or against +27.40, How much reaches you +26.10"
        />
        <TimelineRecords />
      </TimelineSheet>
    </>
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
   a record from 2024, so the content-side fixture is its own: four picks from 5
   to 12 September — seven days, oldest to newest — every one of them drawn, and
   a raw sum the board's own rows add up to (+2.40 / +1.50, past the dial on
   both axes). Its header's words and numbers are checkable by hand against
   these four. */
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

/* ══ THE CHATS ROUND ═════════════════════════════════════════════════════════

   Would-like #3, the third round in the post-MVP tree: the four base boards
   (jakob's rulings 2026-09-23). What the band's chats icon opens once chats
   exist — `ChatsComingSoon` stands in for this page until then.

   A CHAT IS A PROPOSAL IN MESSENGER CLOTHES (jakob 2026-09-23). The backbone
   is the proposal primitive — a message is a signed record put into a chat,
   and membership and the chat's rules ride the same machinery — but NOTHING
   ON THESE BOARDS MAY LOOK LIKE A PROPOSAL. No tallies, no pending-vote
   chrome, no rules panel: a reader meets a messenger, and the primitive stays
   underneath where it belongs. This is the ONE surface where CoGra adopts
   messenger convention wholesale — the list, the bubbles, own messages on the
   right — because chat-app grammar is the thing every reader already knows,
   and inventing a second one would cost them the only fluency they bring.

   MESSAGES NEVER EDIT (jakob 2026-09-23). A sent message is a signed record
   and stays exactly as it was signed, so no bubble carries an `Edited` marker
   and no menu offers Edit — the change-histories round's chronicles have no
   chat twin, by design rather than by omission (chats.md §8: a correction is
   the next message).

   TWO CLOCKS, EACH FOR ITS QUESTION (jakob 2026-09-23). A row on the list
   answers "how fresh is this" and speaks the ages ladder (`35m`, `1d`), like
   every list in the product. A THREAD is a coordination surface — "meet at
   six" needs to know which six — so it is the one place CoGra prints exact
   clock times, on every bubble, with a day divider wherever the messages
   cross a day. The divider speaks the date the change-histories round's
   datelines speak (`22 September`), never `Today` or `Yesterday`, which the
   ages rule keeps off every screen (copy-voice, *Ages*); a far year adds
   itself (`22 September 2025`). The clock follows the device's own 12/24-hour
   setting — the boards draw 24-hour.

   LONG-PRESS IS THE CHATS' SECOND GESTURE, ON BOTH KINDS OF THING (jakob
   2026-09-23: people long-click chats everywhere). A row on the list opens the
   chat's options (`ChatRowMenu`); a bubble opens the message's acts
   (`ChatMessageMenu`). Neither wears a ⋮ — the gesture is the door, the way
   every messenger's is.

   THE PEOPLE are the tree's own fixture cast — Mira is canonical's Mira, with
   her picture — and the reader is Sol, as on every board of this tree. */

const CHAT_MIRA = { name: "Mira Voss", src: "inviter.jpg" };
const CHAT_TOBIAS = { name: "Tobias Lindqvist" };
const CHAT_JUNO = { name: "Juno Baptiste" };
const CHAT_KEL = { name: "Kel Moreau" };

const CHAT_ADA = { name: "Ada Okonkwo" };

/* THE PAGE'S TOP, both faces. The header is the page's, the "?" is the page's
   one — `How chats work`, which opens `ChatsHelp`: that chats are public, that
   encryption is chosen per message, and that sending signs.

   THE TWO FACES SWAP BOTH WAYS through `TabBar` — the opinions page's own row,
   and the right one for the job: its cells are toggles that filter the list
   beneath them (the master's own charter), which is exactly what `Your chats`
   and `All chats` are — one page, two readings of one kind of thing. Two
   cells, words, a hairline: never a segmented pill.

   THE TOP RETRACTS ON SCROLL, BOTH FACES (jakob 2026-09-23). The list is a
   surface a reader dwells in and scrolls for content, so it takes the feed's
   `CollapsingTop` grammar — the header and the tab row leave together on the
   way down and return on the way up (readme §2, the Collapses column). The
   boards draw the top at rest, as every collapsing surface's boards do. A
   chat's THREAD is the opposite case and keeps its pin (`ChatThreadHeader`). */
function ChatsTop({ face }) {
  return (
    <>
      <PageHeader title="Chats" backHref="#" backLabel="Back" action={<HelpDot ariaLabel="How chats work" />} />
      <TabBar
        ariaLabel="Which chats"
        value={face}
        tabs={[
          { id: "yours", label: "Your chats" },
          { id: "all", label: "All chats" },
        ]}
      />
    </>
  );
}

/* The list column — the notifications list's shape (`ChronicleList`): rows are
   `ContentRow` cards 8px apart in the 16px gutter. */
function ChatsColumn({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 0" }}>
      {children}
    </div>
  );
}

/* THE FLOATING NEW CHAT — THE PRODUCT'S FIRST FAB (jakob 2026-09-23).
   `Invites` records the older rule: "this system has no FAB — the bottom bar's
   compose action is the app's one floating create". The chats list is where
   that rule gives, deliberately and only here: a messenger's list is the
   surface every reader already knows as a FAB's home (WhatsApp's grammar), and
   a list that scrolls far enough to bury a head-of-column button is exactly
   the case the head-of-column button was the answer for elsewhere. It hovers
   bottom-right over the list, 16px in from the edge and 16px above the bar,
   and it STAYS while the list scrolls and the top retracts. Both faces carry
   it, the same control in the same corner.

   GLYPH ONLY, AND THE GLYPH IS A BUBBLE WITH A PLUS (`add_comment`). The bar's
   New post is a plus a thumb's width away; a second bare plus on one screen
   would be two identical promises of different things. The accessible name is
   the noun the head-of-column button used to print: `New chat`.

   TONAL, NOT LOUD. `primary-container` is the one loud surface per screen and
   the bar's compose action already spends it, and filled `primary` is the
   committing act — this opens a picker and commits nothing (`BackToTop`'s
   reasoning). So the FAB takes `secondary-container`, Material's tonal FAB
   role, at Material's FAB size and corner: 56px, the large rung. No shadow —
   elevation here is tonal (readme §4), and the fill already lifts it off the
   list's cards. Absolute against the screen, the positioned ancestor every
   overlay hangs from. */
function NewChatFab() {
  return (
    <button
      type="button"
      aria-label="New chat"
      className="cg-state cg-focus"
      style={{
        position: "absolute",
        right: 16,
        bottom: "calc(var(--bottom-bar-height) + 16px)",
        zIndex: 9,
        width: 56,
        height: 56,
        display: "grid",
        placeItems: "center",
        border: 0,
        padding: 0,
        borderRadius: "var(--radius-large)",
        background: "var(--secondary-container)",
        color: "var(--on-secondary-container)",
        cursor: "pointer",
      }}
    >
      <Icon name="add_comment" />
    </button>
  );
}

/* THE MUTED MARK — the one glyph the row adds, riding the name's baseline in
   `ContentRow`'s `titleAside` slot. `volume_off` is already in the set (the
   sound toggle), and a silenced speaker is the mark every messenger a reader
   uses already draws for a muted chat; a new glyph for the same idea would be
   a second drawing of one meaning. Quiet ink, and a name for the ear. */
function MutedMark() {
  return (
    <span role="img" aria-label="Muted" style={{ alignSelf: "center", display: "inline-flex", color: "var(--text-secondary)" }}>
      <Icon name="volume_off" size={14} />
    </span>
  );
}

/* ONE CHAT ON YOUR LIST — `ContentRow`'s chronicle variant, unchanged, which
   already is the messenger row: the disc, the name, one ellipsized line of the
   last message, the age on the trailing edge and the unread dot under it.

   THE DISC IS THE CHAT'S PICTURE, or the partner's face on a 1:1 — the row's
   own precedence (a picture, else a monogram for a name, else the glyph), so a
   group with no picture wears `forum`, the chat's own `NODE_GLYPHS` mark.

   UNREAD IS THE DOT, NEVER A COUNT. The bell's rule at row scale: the honest
   thing the list knows is that something arrived, and `12` is an errand.

   THE PREVIEW IS THE LAST MESSAGE'S WORDS, prefixed by who sent it in a group
   (`You:` for the reader's own) and bare in a 1:1, where there is only one
   other person it could be.

   AN ENCRYPTED MESSAGE PREVIEWS ITS WORDS WHEN THE READER HOLDS THE KEY
   (jakob 2026-09-23). Push already announces them — the notification is the
   drawn row, words and all — so a list that withheld words the phone had just
   shown would be annoyance without honesty. Only a message the reader
   genuinely cannot open previews as what it is, `An encrypted message`, with
   the lock before it (`NoKeyPreview`) — never as scrambled text. On your own
   list that is rare: a member holds every key from the epoch they joined in
   (chats.md §7), so it takes a last message older than your arrival. In the
   explorer it is common, because a non-member holds no key at all. */
function NoKeyPreview({ sender }) {
  return (
    <>
      {sender && `${sender}: `}
      <span role="img" aria-label="End-to-end encrypted">
        <Icon name="lock" size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />
      </span>
      An encrypted message
    </>
  );
}
function ChatRow({ name, image, person, preview, when, unread = false, muted = false }) {
  return (
    <ContentRow
      variant="chronicle"
      chevron={false}
      title={name}
      titleAside={muted ? <MutedMark /> : undefined}
      image={image}
      name={person}
      glyph="forum"
      second={preview}
      trailing={when}
      unread={unread}
      onOpen={() => {}}
    />
  );
}

/* A WORD STANDING IN THE ROW'S ACTION SLOT that is not an action — the
   change-histories round's `Already removed` idiom: `label-small` in
   `text-secondary`, not pressable, exactly where the act would stand. */
function ChatRowWord({ children }) {
  return (
    <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

/* ONE CHAT IN THE EXPLORER. The same row with the same second line — the
   chat's last message — because a chat is public and the explorer reads it
   live: what is being said there now is the best answer to "is this chat for
   me". Its description lives on the chat's own detail surface. A non-member
   holds no key, so every encrypted last message previews as `NoKeyPreview`
   here — the common case on this face, where it is the rare one on yours.

   THE ROW'S ONE CONTROL IS THE JOIN, AND ITS WORD IS THE CHAT'S POLICY
   (jakob 2026-09-23): an open chat says `Join` and joins; one that takes
   requests says `Ask to join`. An invite-only chat has no act a stranger can
   take, so its slot carries the quiet word `Invite only`, and a chat the
   reader is already in — shown only once `Hide chats you're in` is off — says
   `Member`. All four are drawn as `InlineAction` or the quiet word, never a
   filled button: a list of six filled pills is six calls to action, and the
   explorer is for reading.

   THE RANK YIELDS THE EDGE TO THE ACT — `ReferenceRow`'s picker rule: where a
   row's edge is an action, ranking still orders the list and the number is
   not drawn. */
const JOIN_WORD = {
  open: <InlineAction size="sm">Join</InlineAction>,
  request: <InlineAction size="sm">Ask to join</InlineAction>,
  invite: <ChatRowWord>Invite only</ChatRowWord>,
  member: <ChatRowWord>Member</ChatRowWord>,
};

function ChatExploreRow({ name, image, preview, join }) {
  return (
    <ContentRow
      variant="chronicle"
      chevron={false}
      title={name}
      image={image}
      glyph="forum"
      second={preview}
      action={JOIN_WORD[join]}
      onOpen={() => {}}
    />
  );
}

/* THE EXPLORER'S ONE FILTER, AS A QUIET SWITCH ROW (jakob 2026-09-23). A lone
   filter chip stretched to a wide pill is a control that stops reading as
   one; a switch says on-or-off in the product's own settings grammar and sits
   under the tabs at the list's own left edge. `SettingsRow`'s switch variant,
   bare — no group card around a single row. DEFAULT ON: this face exists to
   find chats the reader is not in yet, and the chats they are in are one tab
   away. */
function HideJoinedSwitch({ on = true }) {
  return (
    <div style={{ flex: "none", padding: "4px 0 0" }}>
      <SettingsRow checked={on} label="Hide chats you're in" onOpen={() => {}} />
    </div>
  );
}

/* ── THE THREAD ──────────────────────────────────────────────────────────────

   THE BUBBLE CARRIES CONTENT, TIME, AND THE LOCK WHERE ENCRYPTED — AND NOTHING
   ELSE (jakob 2026-09-23). Everything CoGra does to a message — an opinion, a
   citation, saving it, commenting on it — lives behind a long-press and the ⋮
   it opens, never worn on the bubble. A bubble with a stance face and a score
   on it would be a post card in a costume, and a thread of them would read as
   a feed.

   OWN ON THE RIGHT, OTHERS ON THE LEFT, messenger grammar. The reader's own
   bubbles take `secondary-container` — the tonal role the system already
   spends on "yours, chosen" (a selected chip, a monogram's own fill) — and
   everyone else's take `surface-card`, the card rung every other piece of
   content stands on. `primary-container` is spoken for (one loud place per
   screen), and on this screen that place is nobody's bubble.

   AUTHORSHIP IN A GROUP: the name opens a run of someone's bubbles and their
   face closes it, the corner nearest the face tightening to point at it —
   every group messenger's arrangement. The name is the display name, the way
   the bubble reads a person rather than an account.

   THE TIME IS THE CLOCK (jakob 2026-09-23) — `08:40`, exact, on every bubble,
   because a thread is where people agree on when; the day it belongs to is the
   `DayDivider` above its day's first message. The list keeps the ages ladder.

   THE INK ON THE READER'S OWN BUBBLE IS `text-body` (jakob's review, a
   conformance fix). `on-secondary-container` is the fill's formal pair, but it
   measures 4.58:1 on the light fill — AA at the floor, and too faint for body
   text a reader lives in. `text-body` (`on-surface`) measures 9.19:1 there and
   6.95:1 on the dark fill, and it is the ink every other message is already
   set in, so the reader's words and everyone else's read at one strength. The
   time and the lock on the own bubble take it too; on a foreign bubble they
   stay `text-secondary`, 7.24:1 on the card. The loudness of the fill is not
   the defect and stays.

   `sealed` IS THE QUIET LOCK (jakob 2026-09-23: "even if you can read a
   message you should be aware that it was sent e2e"). A 12px `lock` beside the
   time, in the time's own ink — present on every encrypted message whether or
   not the reader can open it, and absent on plaintext. Never a banner, never
   a colour: a reader should know, not be alarmed.

   A MESSAGE MAY CARRY A PICTURE OR A CLIP (`media`), at comment scale — the
   comment's own rule that media joins the words and must not turn them into a
   post: inset at the medium rung above the words, held to 220px, filled not
   fitted. A clip carries the sound disc and nothing more (the control ladder's
   feed rung); the transport lives in the viewer a tap away, never in a bubble.

   `id` names the bubble for the flow layer — a long-press lands on the whole
   bubble, so the badge does. */
function ChatBubble({ own = false, author, first = true, last = true, when, sealed = false, media, id, children }) {
  const ink = own ? "var(--text-body)" : "var(--text-secondary)";
  const tail = own ? { borderBottomRightRadius: "var(--radius-extra-small)" } : { borderBottomLeftRadius: "var(--radius-extra-small)" };
  return (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
      {!own && (last ? <MonogramAvatar name={author.name} src={author.src} size="md" /> : <span style={{ flex: "none", width: 32 }} />)}
      <div
        data-message={id}
        style={{
          maxWidth: "78%",
          width: media ? "78%" : undefined,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "8px 12px",
          borderRadius: "var(--radius-large)",
          ...(last ? tail : {}),
          background: own ? "var(--secondary-container)" : "var(--surface-card)",
          color: "var(--text-body)",
        }}
      >
        {!own && first && (
          <span style={{ fontSize: "var(--text-label-medium)", lineHeight: "var(--text-label-medium--line-height)", fontWeight: "var(--text-label-medium--font-weight)" }}>
            {author.name}
          </span>
        )}
        {media && (
          <div style={{ margin: "4px 0 2px" }}>
            <MediaAttachment {...media} radius="var(--radius-medium)" maxHeight="220px" />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          {children}
        </div>
        <span style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: ink }}>
          {sealed && (
            <span role="img" aria-label="End-to-end encrypted" style={{ display: "inline-flex" }}>
              <Icon name="lock" size={12} />
            </span>
          )}
          {when}
        </span>
      </div>
    </div>
  );
}

/* THE MESSAGE THE READER HOLDS NO KEY FOR. Its bubble is an ordinary bubble —
   it has an author and a time like any other, and it wears the lock like any
   other encrypted message — and its content is a friendly notice in the
   bubble's own `text-body` ink (jakob's review: the secondary ink the notice
   first wore was too faint to read, and a notice nobody can read explains
   nothing): what this is, and why it will not open. The notice
   is the face; the raw text is one tap under it. `Show the encrypted text`
   expands the bubble in place to the scrambled text itself, set in the
   platform monospace (`TextField`'s `mono` register for strings read character
   by character), and the notice stays above it. Drawn: the notice state; the
   expanded state is behaviour, stated here.

   A MESSAGE WITH NO KEY IS NOT AN ERROR. Nothing failed — the sender chose to
   encrypt, and the key that opens it is not with this reader. So no `error`
   ink and no warning glyph; and not the `tertiary` waiting register either,
   because nothing here changes by waiting. */
function ChatSealedNotice() {
  return (
    <>
      <span>An encrypted message — you don't have the key to read it.</span>
      <InlineAction size="sm" selfStart>
        Show the encrypted text
      </InlineAction>
    </>
  );
}

/* The thread column: newest at the foot, the way a thread is read, so a short
   thread sits on the foot rather than hanging from the header. */
function ChatThreadColumn({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12, padding: "8px 16px 12px" }}>
      {children}
    </div>
  );
}

/* THE DAY A RUN OF MESSAGES BELONGS TO — one quiet centred line where the
   thread crosses a day, in the dateline's words (`22 September`). It is a
   label, not a control, and carries no container: the gap around it is what
   sets it apart from the bubbles. */
function DayDivider({ children }) {
  return (
    <div style={{ alignSelf: "center", padding: "4px 0", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
      {children}
    </div>
  );
}

/* THE THREAD'S HEADER — THE CHAT'S PICTURE AND NAME, AND THE DOOR BEHIND THEM
   (jakob 2026-09-23). `PageHeader`'s band and back target, to the pixel; where
   that master prints a title, this prints the chat's own face and name as ONE
   pressable — the messenger's door into the chat's detail surface: members,
   description, mute, leave, and the history of its name and picture.

   THE DESTINATION IS DELIBERATELY UNDRAWN. The detail surface is a later
   sub-round of the chats work, and the one gap this round leaves on purpose
   (graph: a gap). The door is drawn now so the thread's anatomy is final.

   IT PINS. A thread is where a reader writes, and the way back and the chat's
   own name must never leave mid-conversation — readme §2's Pins column. The
   list above it collapses; the thread does not. */
function ChatThreadHeader({ name, image, backLabel = "Back to your chats" }) {
  return (
    <header style={{ flex: "none", display: "flex", alignItems: "center", gap: "var(--space-1)", minHeight: 48, padding: "0 var(--space-3)" }}>
      <a
        href="#"
        aria-label={backLabel}
        className="cg-state cg-focus"
        style={{ height: 48, width: 48, display: "grid", placeItems: "center", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", textDecoration: "none", flex: "none" }}
      >
        <Icon name="arrow_back" />
      </a>
      <button
        type="button"
        aria-label={`${name} — chat details`}
        className="cg-state cg-focus"
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 48, padding: "0 var(--space-2)", border: 0, background: "none", borderRadius: "var(--radius-medium)", color: "var(--on-surface)", fontFamily: "var(--font-sans)", textAlign: "left", cursor: "pointer" }}
      >
        {image ? (
          <img src={image} alt="" style={{ width: 32, height: 32, flex: "none", borderRadius: "var(--radius-full)", objectFit: "cover", display: "block" }} />
        ) : (
          <span aria-hidden="true" style={{ width: 32, height: 32, flex: "none", display: "grid", placeItems: "center", borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)" }}>
            <Icon name="forum" size={18} />
          </span>
        )}
        <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </span>
      </button>
    </header>
  );
}

/* ── THE FOOT — A LIVE FIELD, AND THE ARROW THAT SEALS ────────────────────────

   THE SEND ARROW IS THE SEAL (jakob 2026-09-23). A message is a signed record,
   and the signing ceremony compresses into the send act: tapping the arrow
   signs the message in the reader's name and puts it into the chat — no seal
   page, no second tap. It is the seal's own filled `primary` in round form,
   and its accessible name says what it does: `Sign and send`, the seal's
   verb-names-the-act rule (`SealFooter`).

   LONG-PRESS ON THE ARROW OPENS THE WHAT-YOU-SIGN SHEET (`ChatSignSheet`) —
   the seal's reading, for the reader who wants it: this one message, where it
   goes, whether it is encrypted, its license and the opinion it carries. And
   the reader is told so ONCE: a quiet line under the foot on their FIRST send
   ever, gone after it (`firstSend`; see `ChatThread` for the tension with the
   own bubbles above it).

   THE LOCK TOGGLE — THE PER-MESSAGE ENCRYPTION CHOICE (jakob 2026-09-23).
   Beside the field, where the thumb already is. Its state is the lock's
   FILL: `lock_outline` off, `lock` on, in the same quiet `text-secondary` ink
   either way, `aria-pressed` for the ear — never a colour change, never a
   banner. STICKY PER CHAT: the choice holds for the next message in this chat
   until the reader flips it. DEFAULT PLAINTEXT for a fresh chat; the thread
   draws it off, the keyboard board on. The lock's accessible name is the act
   it takes: `Encrypt end to end`.

   THE FIELD IS LIVE — the comment foot's door ruling (readme §13, *The foot
   ruling*) left this question to the chats round, and a chat is an inline
   signed send, so here the field is typed in. It is `TextField` at `rows={1}`
   and grows by the growth law, taking its room from the thread above it — the
   sheets-and-video round's "every chat app" case. Whether the comment foot
   now inherits a live field is a separate ruling this round does not take.

   KEY ABSENT GATES THE FOOT — the `KeyElsewhere` pattern, not drawn here:
   without the signing key the arrow cannot seal, so the reader meets the
   restore-first notice rather than a send that silently waits, and the thread
   above keeps reading. Its drawing is owed to a later chats board. */
function LockToggle({ on = false }) {
  return (
    <button
      type="button"
      aria-pressed={on ? "true" : "false"}
      aria-label="Encrypt end to end"
      className="cg-state cg-focus cg-hit"
      style={{ display: "grid", placeItems: "center", width: 40, height: 40, flex: "none", border: 0, padding: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer" }}
    >
      <Icon name={on ? "lock" : "lock_outline"} size={22} />
    </button>
  );
}

function SendSeal() {
  return (
    <button
      type="button"
      aria-label="Sign and send"
      className="cg-state cg-focus cg-hit"
      style={{ display: "grid", placeItems: "center", width: 40, height: 40, flex: "none", border: 0, padding: 0, background: "var(--primary)", color: "var(--on-primary)", borderRadius: "var(--radius-full)", cursor: "pointer" }}
    >
      <Icon name="send" size={20} />
    </button>
  );
}

/* The foot's two icon controls sit on the FIELD's centre line, not the label's:
   each rides in a box the single-line field's own height (24px of body-large
   leading, 16px of padding, the 1px border twice). */
function FieldAligned({ children }) {
  return <span style={{ flex: "none", height: 42, display: "grid", placeItems: "center" }}>{children}</span>;
}

function ChatFoot({ draft = "", sealed = false, firstSend = false }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 16px", borderTop: "1px solid var(--border-hairline)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <FieldAligned>
          <LockToggle on={sealed} />
        </FieldAligned>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField label="Message" rows={1} value={draft} />
        </div>
        <FieldAligned>
          <SendSeal />
        </FieldAligned>
      </div>
      {firstSend && <QuietNote>Sending signs the message in your name. Press and hold the arrow to see what you sign.</QuietNote>}
    </div>
  );
}

/* THE FOOT A READER WHO IS NOT A MEMBER MEETS (jakob 2026-09-23). Chats are
   public reads, so the thread above is the thread any member reads — and where
   a member's foot would be, the join stands, worded by the chat's policy:
   `Join` for an open chat, `Ask to join` for one that takes requests. It is
   the page's one committing act, so it is the filled button at full width (the
   seal's grammar), and it is the only thing in the foot: no field, because a
   non-member's Send would never reach the transcript (chats.md §2 — the
   membership gate is the read-side fold). An invite-only chat offers nothing a
   stranger can press; its foot carries the quiet `Invite only` line instead
   (stated here, not drawn). */
function ChatJoinFoot({ policy = "request" }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 16px", borderTop: "1px solid var(--border-hairline)" }}>
      {policy === "invite" ? (
        <QuietNote>Invite only — a member can invite you.</QuietNote>
      ) : (
        <Button style={{ width: "100%" }}>{policy === "open" ? "Join" : "Ask to join"}</Button>
      )}
    </div>
  );
}

/* ── THE BODIES MORE THAN ONE BOARD DRAWS ─────────────────────────────────────
   `ThreadDetail`'s rule: what a sheet or a dialog covers is the real surface,
   inert, never a stand-in — so the list, the thread and the picker are written
   once here and every board that opens something over them draws them whole. */

function ChatsHomeRows() {
  return (
    <>
      <ChatRow name="Coast walkers" image="post-photo.jpg" preview="Mira Voss: Six it is. Meet at the harbour office." when="35m" unread />
      <ChatRow name="Ada Okonkwo" person="Ada Okonkwo" preview="The third headland light is real — I have a print that almost catches it." when="2h" unread />
      <ChatRow name="Headland honey" image="gallery-honey.jpg" preview="Kel Moreau: Jars are back on the stand from Saturday." when="5h" muted />
      <ChatRow name="Tobias Lindqvist" person="Tobias Lindqvist" preview="You: See you at the slipway." when="1d" />
      <ChatRow name="Salt-crust rubbings" preview="Juno Baptiste: The new rubbings are drying in the loft." when="3d" />
      <ChatRow name="Sea wall choir" preview={<NoKeyPreview sender="Kel Moreau" />} when="4d" />
    </>
  );
}

function ChatsHomeBody() {
  return (
    <>
      <ChatsTop face="yours" />
      <ChatsColumn>
        <ChatsHomeRows />
      </ChatsColumn>
      <NewChatFab />
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

/* THE COAST WALKERS THREAD, across three days. Kel's message is the oldest on
   purpose: it was sealed under a key epoch from before the reader joined
   (chats.md §7 — a joiner holds the current epoch onward), which is the one
   honest way a member meets a message they cannot open in their own chat. */
function CoastWalkersThread() {
  return (
    <ChatThreadColumn>
      <DayDivider>21 September</DayDivider>
      <ChatBubble author={CHAT_KEL} when="19:02" sealed>
        <ChatSealedNotice />
      </ChatBubble>
      <DayDivider>22 September</DayDivider>
      <ChatBubble author={CHAT_MIRA} when="21:10">
        Low tide's at six tomorrow — anyone walking the flats?
      </ChatBubble>
      <ChatBubble own when="21:31">
        Crust held all the way past the slipway today.
      </ChatBubble>
      <DayDivider>23 September</DayDivider>
      <ChatBubble author={CHAT_JUNO} when="08:05" sealed id="boots">
        I'll bring the spare boots — tell me your size.
      </ChatBubble>
      <ChatBubble author={CHAT_MIRA} when="08:40">
        Six it is. Meet at the harbour office.
      </ChatBubble>
    </ChatThreadColumn>
  );
}

function ChatThreadBody({ firstSend = false }) {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <CoastWalkersThread />
      <ChatFoot draft="Bringing a flask." firstSend={firstSend} />
    </>
  );
}

/* THE PEOPLE PICKER'S CANDIDATES — `ReferencePicker`'s rows at person kind:
   the face, the name, the handle under it. Ranked the ordinary way, as every
   picker's list is; the number yields the edge (`ReferenceRow`'s picker rule).
   `add` puts the add mark on the edge, the tag picker's grammar, where a tap
   stages the person rather than opening a chat. */
function PeopleRows({ people, add = false }) {
  return people.map((p) => (
    <ReferenceRow key={p.handle} kind="person" name={p.name} sub={`@${p.handle}`} src={p.src} trailing={add ? <Icon name="add" size={20} /> : undefined} onOpen={() => {}} />
  ));
}

const PICKER_PEOPLE = [
  { name: "Ada Okonkwo", handle: "ada" },
  { name: "Mira Voss", handle: "mira", src: "inviter.jpg" },
  { name: "Tobias Lindqvist", handle: "tobias" },
  { name: "Juno Baptiste", handle: "juno" },
  { name: "Kel Moreau", handle: "kel" },
  { name: "Sal Torres", handle: "saltorres" },
];

function ChatPickerBody() {
  return (
    <>
      <PageHeader title="New chat" backHref="#" backLabel="Back to your chats" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search people" />
        <div style={{ padding: "0 16px 8px" }}>
          <ContentRow variant="door" title="New group chat" glyph="forum" onOpen={() => {}} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <PeopleRows people={PICKER_PEOPLE} />
      </div>
    </>
  );
}
