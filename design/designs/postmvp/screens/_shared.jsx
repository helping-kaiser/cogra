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

   THE DESTINATION IS `ChatDetails` — or `ChatDetailsReader` for a reader
   outside the chat — drawn by the chat details round, which resolved the gap
   the chats round left here on purpose.

   SEARCH RIDES THE HEADER'S TRAILING EDGE (jakob 2026-09-23, the details
   round's fix pass). `Search in this chat` left the details page for a glyph
   beside the door — the messenger's place for it, one tap from the thread a
   reader is searching. The door keeps the whole middle of the band, and the
   glyph is a 48px target of its own, so the two never share a tap. Every
   thread wears it, a reader's outside the chat included: plaintext is a public
   read, and the search's truth note says the same to both.

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
      <button
        type="button"
        aria-label="Search in this chat"
        className="cg-state cg-focus"
        style={{ height: 48, width: 48, flex: "none", display: "grid", placeItems: "center", border: 0, padding: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer" }}
      >
        <Icon name="search" />
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
   (stated here, not drawn).

   THE FOOT MOVES WITH THE READER'S OWN STANDING (the chats governance round,
   2026-09-23). `state` draws the three moments between asking and belonging,
   each still a non-member's foot — no field, no lock, no arrow:
   · `invited` — someone's Invitation names the reader. The foot says who, in
     one quiet line, and the join stands under it, filled. There is no Decline:
     ignoring an invitation needs no record at all (chats.md §4), so a refusal
     act would be a button for a thing that happens by doing nothing.
   · `requested` — the reader asked; the foot says the request is sent and
     nothing more is pressable. It names no one who decides — the chats
     round's rule that governance ships silently.
   · `approved` — the request passed; the join stands alone, filled, because
     the transcript's outcome line directly above it says why. */
function ChatJoinFoot({ policy = "request", state, invitedBy }) {
  const join = <Button style={{ width: "100%" }}>Join</Button>;
  let body;
  if (state === "invited") {
    body = (
      <>
        <QuietNote>{`${invitedBy} invited you.`}</QuietNote>
        {join}
      </>
    );
  } else if (state === "requested") {
    body = <QuietNote>Your request is sent — you can join once it's approved.</QuietNote>;
  } else if (state === "approved") {
    body = join;
  } else if (policy === "invite") {
    body = <QuietNote>Invite only — a member can invite you.</QuietNote>;
  } else {
    body = <Button style={{ width: "100%" }}>{policy === "open" ? "Join" : "Ask to join"}</Button>;
  }
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 16px", borderTop: "1px solid var(--border-hairline)" }}>
      {body}
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

/* THE HARBOUR OFFICE THREAD, as a reader outside the chat reads it — two of
   its four messages sealed, so they show as notices to a non-member. Drawn
   once because three boards draw it: the reader's thread, and the requester's
   two moments after asking (`ChatThreadRequested`, `ChatThreadApproved`),
   which are the same transcript with one card more. `after` is what stands at
   the transcript's foot after the last message. */
function HarbourOfficeThread({ after }) {
  return (
    <ChatThreadColumn>
      <DayDivider>22 September</DayDivider>
      <ChatBubble author={CHAT_KEL} when="17:45" sealed>
        <ChatSealedNotice />
      </ChatBubble>
      <ChatBubble author={CHAT_MIRA} when="18:02">
        The lost-and-found has a blue wool hat and one glove. Whose?
      </ChatBubble>
      <DayDivider>23 September</DayDivider>
      <ChatBubble author={CHAT_TOBIAS} when="08:30">
        Opening at nine this morning, not eight.
      </ChatBubble>
      <ChatBubble author={CHAT_JUNO} when="08:44" sealed>
        <ChatSealedNotice />
      </ChatBubble>
      {after}
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

/* ══ THE CHAT DETAILS ROUND ══════════════════════════════════════════════════

   Round B1 of the chats work (jakob's rulings 2026-09-23): the surface behind
   the thread's header and the row menu's `Chat details` — the one destination
   the chats round left undrawn on purpose — and its satellites: the edit and
   its seal, the chronicle, search, media, and the leave.

   STILL MESSENGER CLOTHES (jakob 2026-09-23). A chat's details are a group-info
   page every messenger reader already knows — the face, the name, the words,
   the members, mute and leave — and the proposal machinery stays underneath.
   A MULTI-VOICE ACT IS INSTANT WHERE THE ACTOR'S OWN VOICE SUFFICES under the
   chat's governance map, and otherwise it waits as a quiet pending card IN THE
   THREAD and a row under `Open decisions` here. This round draws the section
   and its empty state; the pending card and the filled section are the
   governance round's (`PendingCard`, `OpenDecisions`, below).

   NO PRESENCE, EVER (jakob 2026-09-23). No online dot, no last-seen, no
   typing line on any member row or anywhere else: the member list says who is
   in the chat and in what role, which are public records, and nothing about
   what a person is doing right now, which is not.

   CHATS ARE PUBLIC, SO THIS SURFACE IS TOO (jakob 2026-09-23). A non-member
   and a guest read the same details — the face, the words, the members, the
   history, the media, search — minus the acts only a member has, with the join
   worded by the chat's policy (`ChatDetailsReader`). */

/* THE POLICY, SAID BACK IN ONE LINE — the founding seal's own sentence
   (`A new group chat — invite only.`) without the `new`, and each line says
   what a joiner meets, never who decides (the founding's rule: governance
   ships silently). */
const CHAT_POLICY_LINE = {
  open: "A group chat — anyone can join.",
  request: "A group chat — anyone can ask to join.",
  invite: "A group chat — invite only.",
};

/* THE CHAT'S DISC — its picture, or `forum` on the reserved fill where it has
   none: the founding's own 64px disc and the thread header's 32px one are this
   drawing at two sizes. */
function ChatDisc({ image, size = 64 }) {
  const glyph = Math.round(size * 0.44);
  return image ? (
    <img src={image} alt="" style={{ width: size, height: size, flex: "none", borderRadius: "var(--radius-full)", objectFit: "cover", display: "block" }} />
  ) : (
    <span
      aria-hidden="true"
      style={{ flex: "none", width: size, height: size, display: "grid", placeItems: "center", borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)" }}
    >
      <Icon name="forum" size={glyph} />
    </span>
  );
}

/* THE TOP OF THE DETAILS — `ProfileHeader`'s compact shape, because it is the
   same job one kind over: the face left at 80px, the name as the page's one
   heading beside it, the words under both, then ONE actions row. Not a card:
   it is the top of the screen, on the page ground (the header's own rule).

   THE CHAT'S OPINION CONTROL LEADS THE ACTIONS ROW (jakob 2026-09-23: the
   profile header's stance-anchor precedent). A chat is first-class content
   (chats.md §1) and an opinion on it is an ordinary Opinion → Chat, the space's
   own sentiment (§4, *Membership sentiment*) — so it wears the wide anchor, the
   row's one stretched action, and whatever the row's second act is takes its
   word's width beside it (`Message`'s sizing rule): `Edit chat` for a member
   the map lets propose a change, the join for a reader outside. */
function ChatIdentity({ name, image, policy, description, children }) {
  return (
    <header style={{ flex: "none", display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-3) 16px var(--space-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <ChatDisc image={image} size={80} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: "var(--text-title-large--font-weight)", overflowWrap: "anywhere" }}>
            {name}
          </h1>
          <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{CHAT_POLICY_LINE[policy]}</span>
        </div>
      </div>
      {description && <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{description}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StanceControl wide targetLabel={name} onCommit={() => {}} />
        </div>
        {children}
      </div>
    </header>
  );
}

/* A GROUP OF DOORS — `SettingsGroup` at the list gutter, headed by nothing
   but its accessible name: the rows name themselves. */
function DetailsGroup({ ariaLabel, children }) {
  return (
    <div style={{ flex: "none", padding: "12px 16px 0" }}>
      <SettingsGroup ariaLabel={ariaLabel}>{children}</SettingsGroup>
    </div>
  );
}

/* OPEN DECISIONS — THE SECTION, BESIDE MEDIA (jakob 2026-09-23). Where an act
   needs more voices than its actor's, it waits here and in the thread; with
   nothing waiting, the section says so in the wallet's empty-history register
   (`WalletEmpty`: the section's own label, one quiet line in `body-medium`
   `text-secondary` at the label's gutter) — never a hidden section, because a
   section that appears only when something is pending teaches a reader that
   its absence means something else. Filled, it is `OpenDecisions`. */
function OpenDecisionsEmpty() {
  return (
    <div style={{ flex: "none" }}>
      <SectionLabel>Open decisions</SectionLabel>
      <p style={{ margin: 0, padding: "4px 24px 0", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
        Nothing is being decided.
      </p>
    </div>
  );
}

/* THE MEMBER LIST — `ReferenceRow` at person kind, the picker's row: the
   face, the name, the handle under it, and on the trailing edge the ROLE
   (jakob 2026-09-23) — `Admin`, `Moderator`, `Member`, the default map's
   three roles (chats.md §5) in the reader's words. For a member the word is a
   door (`RoleDoor`, below); for a reader outside it is the row's plain
   `value`. Every member row carries its word, `Member` included, so the one row that
   carries none is the one that is not a member yet.

   THE FOUNDER HOLDS ADMIN FROM THE FOUNDING ACT (jakob 2026-09-23, chats.md
   §3) — the reader founded this chat, so the first row is theirs. Every later
   role came through `decision:change_role`.

   A MEMBER CAN BE A COLLECTIVE, and it wears the person's row: `ActorChip`'s
   own rule is that a Collective looks like a person and reads as a shared
   identity. Its second line says which it is, because nothing else on the
   row would — the Collective actor variant is specified and not yet built
   (readme §7), and this line is the least a list owes a reader until it is.

   AN INVITED PERSON WHO HAS NOT POINTED BACK IS PENDING (jakob 2026-09-23).
   Founding creates the chat whole at once; an invitation is a vouch, and
   membership materialises only from the invitee's own Participant (chats.md
   §4). So the invitee is listed — the Invitation is a public record — with
   `Invited — hasn't joined yet` where the handle would be and no role at the
   edge. THE THREAD'S QUIET LINE for the same fact is a state of the drawn
   thread (`ChatThread`), not a board of its own.

   NO PRESENCE on any row — see the round's charter above. A tap opens the
   person's profile (canonical's). */
const ROLE_WORD = { admin: "Admin", chat_mod: "Moderator", member: "Member" };
const PENDING_INVITE_LINE = "Invited — hasn't joined yet";

/* THE ROLE READOUT IS A DOOR (jakob 2026-09-23, the details round's fix
   pass). Tapping `Admin`, `Moderator` or `Member` opens the role-change flow —
   `decision:change_role`, a multi-voice act whose face is `ChatRoleSheet`. The
   grammar is the stance row's split (`StanceRow`, the change-histories round):
   a readout at a row's end that opens its own surface splits the row, so the
   person area opens the person and the word opens the role — never a control
   inside a control. And a door has to look like one, so the word takes the
   `EditedMarker`'s tappable form — the same quiet ink, the same underline —
   and a spoken name that says where it goes (`Admin — change the role`).

   A MEMBER'S DOOR, ON EVERY MEMBER'S ROW, the reader's own included: the
   default map lets every active member propose a role change (chats.md §5),
   and excludes the subject only from the tally, never from being asked
   about. A reader outside the chat is not eligible, so their list keeps the
   plain readout (`roleDoors` off). THE PENDING INVITEE HAS NO ROLE AND NO
   DOOR — there is nothing to change until they join. */
function RoleDoor({ role }) {
  const word = ROLE_WORD[role];
  return (
    <button
      type="button"
      aria-label={`${word} — change the role`}
      className="cg-state cg-focus cg-hit"
      style={{ flex: "none", alignSelf: "stretch", display: "inline-flex", alignItems: "center", border: 0, background: "none", padding: "0 24px 0 12px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)", textDecoration: "underline" }}
    >
      {word}
    </button>
  );
}

/* The person half of a split member row — `ReferenceRow`'s person anatomy to
   the pixel (its disc, its two lines, its gutter), stopping where the role
   door begins. */
function MemberPerson({ m }) {
  return (
    <button
      type="button"
      className="cg-state cg-focus"
      style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: "var(--touch-target-min)", border: 0, background: "none", padding: "var(--space-1) 0 var(--space-1) var(--space-6)", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" }}
    >
      <MonogramAvatar name={m.name} src={m.src} size="md" />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
        <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {m.sub ?? `@${m.handle}`}
        </span>
      </span>
    </button>
  );
}

function MemberRows({ members, roleDoors = false }) {
  return members.map((m) =>
    roleDoors && !m.pending ? (
      <div key={m.handle} style={{ display: "flex", alignItems: "stretch" }}>
        <MemberPerson m={m} />
        <RoleDoor role={m.role} />
      </div>
    ) : (
      <ReferenceRow
        key={m.handle}
        kind="person"
        name={m.name}
        src={m.src}
        sub={m.pending ? PENDING_INVITE_LINE : m.sub ?? `@${m.handle}`}
        value={m.pending ? undefined : ROLE_WORD[m.role]}
        onOpen={() => {}}
      />
    ),
  );
}

/* The members' section: the label, then — for a member — the way to invite
   more people first, the messenger's place for it and `ChatPicker`'s own
   head-row grammar (`ContentRow`'s door, 16px gutter), then the rows. */
function MembersSection({ members, addPeople = false, roleDoors = false }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column" }}>
      <SectionLabel>Members</SectionLabel>
      {addPeople && (
        <div style={{ padding: "4px 16px 4px" }}>
          <ContentRow variant="door" title="Add people" glyph="add" onOpen={() => {}} />
        </div>
      )}
      <MemberRows members={members} roleDoors={roleDoors} />
    </div>
  );
}

const COAST_WALKERS = {
  name: "Coast walkers",
  image: "post-photo.jpg",
  policy: "invite",
  description: "Who is out on the flats, and when the crust holds. Walks leave from the harbour office.",
};

const COAST_WALKERS_MEMBERS = [
  { name: "Sol Ferreira", handle: "sol", sub: "@sol · you", role: "admin" },
  { name: "Mira Voss", handle: "mira", src: "inviter.jpg", role: "chat_mod" },
  { name: "Harbour Rowing Club", handle: "rowingclub", sub: "@rowingclub · a collective", role: "member" },
  { name: "Juno Baptiste", handle: "juno", role: "member" },
  { name: "Kel Moreau", handle: "kel", role: "member" },
  { name: "Tobias Lindqvist", handle: "tobias", role: "member" },
  { name: "Ada Okonkwo", handle: "ada", pending: true },
];

/* THE MEMBER'S DETAILS, WHOLE — drawn once because every board over it draws
   it: the surface itself, the leave dialog and the role sheet over it
   (`ThreadDetail`'s rule: what a modal covers is the real surface, inert), and
   the governance round's filled twin. The anatomy's order and its reasons are
   `ChatDetails`' docblock. `chat`, `members` and `decisions` default to Coast
   walkers with nothing being decided; `decisions` fills the section
   (`OpenDecisions`) where the governance round's fixture has some. */
function ChatDetailsBody({ chat = COAST_WALKERS, members = COAST_WALKERS_MEMBERS, decisions }) {
  return (
    <>
      <PageHeader title="Chat details" backHref="#" backLabel="Back to the chat" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        <ChatIdentity {...chat}>
          <Button variant="outline" style={{ flex: "none" }}>
            Edit chat
          </Button>
        </ChatIdentity>
        <DetailsGroup ariaLabel="In this chat">
          <SettingsRow label="Media in this chat" onOpen={() => {}} />
        </DetailsGroup>
        {decisions ? <OpenDecisions rows={decisions} /> : <OpenDecisionsEmpty />}
        <MembersSection members={members} addPeople roleDoors />
        <DetailsGroup ariaLabel="This chat">
          <SettingsRow checked={false} label="Mute this chat" status="No push for its messages. It keeps its place and its dot on your list." onOpen={() => {}} />
          <SettingsRow label="Edit history" onOpen={() => {}} />
        </DetailsGroup>
        <DetailsGroup ariaLabel="Leave">
          <SettingsRow action label="Leave this chat" onOpen={() => {}} />
        </DetailsGroup>
      </div>
    </>
  );
}

/* ── THE CHAT'S EDIT HISTORY ──────────────────────────────────────────────────

   A CHAT'S METADATA GROWS THE WAY A POST'S AND A PROFILE'S DO (jakob
   2026-09-23): layered, full-state versions. On L1 the mechanism is
   succession — the lineage head's founding payload IS the chat's current
   metadata, and an update is a new head whose payload carries the whole new
   state (chats.md §8) — so a version here is a whole founding payload as a
   reader can see it: the face, the name, the words and who can join. The rest
   of that payload (the governance map beyond the policy, the system actor's
   name) ships silently, as it did at the founding.

   THE CHRONICLE IS THE CHANGE-HISTORIES PATTERN VERBATIM: whole versions,
   newest first, the current one marked by its dateline, never a diff.

   MEMBERSHIP EVENTS INTERLEAVE AS QUIET ROWS BETWEEN THE VERSIONS (jakob
   2026-09-23), each at its own date — and they are NEVER part of a version's
   state. Membership is a fold over its own records (chats.md §4), and it
   carries across a succession with nobody acting, so a version card that
   listed members would be claiming a snapshot no payload holds. */

/* One version of the chat — the details' identity at chronicle scale, the way
   `ProfileVersionCard` is the profile header's. Inert: a chat has no historic
   detail surface to open (the profile chronicle's precedent). */
function ChatVersionCard({ name, image, policy, description }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ChatDisc image={image} size={64} />
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>{name}</span>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>{CHAT_POLICY_LINE[policy]}</span>
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{description}</p>
    </Card>
  );
}

/* ONE MEMBERSHIP EVENT — a quiet row, no container: the actor's face at row
   scale, what they did in one sentence, and the date on the trailing edge in
   the dateline's words. `TimelineRow`'s quiet register (every word
   `text-secondary`, the date `label-small`), so it reads as a note between two
   versions and never as a third kind of card.

   A LEAVE MAY CARRY ITS PARTING REASON (jakob 2026-09-23: the Leave record takes
   an optional one, chats.md §2). Where the leaver gave one it is theirs and it
   is public, so it stands under the sentence in their own words, quoted. */
function ChatEventRow({ who, src, when, reason, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 24px" }}>
      <MonogramAvatar name={who} src={src} size="sm" />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
        <span>{children}</span>
        {reason && <span>“{reason}”</span>}
      </span>
      <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{when}</span>
    </div>
  );
}

/* ══ THE CHATS GOVERNANCE ROUND ══════════════════════════════════════════════

   Round B2 of the chats work (jakob's rulings 2026-09-23): the multi-voice
   acts the details round left as intended gaps — the pending card and the
   filled `Open decisions`, the invitation into an existing chat, the join in
   its three routes, the request's two sides, the role change and a version's
   removal.

   THE LAW (jakob 2026-09-23). A chat's backbone is the proposal machinery, and
   NOTHING MAY LOOK LIKE A PROPOSAL. An act whose actor's own say clears its
   gate is INSTANT: it is a proposal passing on its proposer's first ballot, so
   its seal counts the anchor, its reference to the subject and the proposer's
   own ballot — `3 things, signed together`, `ChatEditSeal`'s precedent. An act
   that needs more voices becomes a QUIET PENDING CARD IN THE THREAD, at the
   moment it was proposed: a plain sentence (`Mira Voss wants to remove Kel
   Moreau from the chat`), an `Agree` that is a ballot in disguise, and a plain
   count of PEOPLE (`2 of 5 so far`). When the tally crosses, the card settles
   into its outcome line (`Kel Moreau was removed`). The same open decisions
   stand as rows under `Open decisions` on the details. Proposals never expire,
   so no card carries a clock or a deadline.

   THE COUNT CONVENTION — the brief's recommendation, flagged for jakob's
   canvas review. A card counts PEOPLE and never shows weight: `2 of 5` is two
   of the five who have a say. The tally underneath is weighted (the default
   map: admin 5, moderator 3, member 1; chats.md §5), so a card can settle
   "early" — at 3 of 5, if an admin is among the three — and it simply settles
   when it settles; no card promises a number of people it will take. GEEK MODE
   REVEALS THE ARITHMETIC in the geek-pair grammar (`ExactTail`: a `cg-exact`
   span that paints only with exact values on, and a spoken twin that says it
   in both modes). This extends the geek round's "the pairs, and only the pairs"
   to a governance tally — named here, because it is a widening of that ruling
   and not a reading of it. */

/* THE DECISIONS CHAT — Salt-crust rubbings, where the reader is a plain
   member. The fixture moved off Coast walkers ON PURPOSE: there the reader is
   the founder and admin, and an admin's own say clears the rename gate in any
   chat this size (`decision:set:metadata`: > 50% of the cast, a 10% quorum —
   5 of Coast walkers' 12 is 42%), so the reader's own pending rename the round
   needs cannot honestly stand there. Here the reader weighs 1.

   THE ARITHMETIC, checkable by hand (chats.md §5, the default map; quorum is
   the share of the eligible weight that has cast, governance.md §2.4):
   · Juno admin 5 · Mira moderator 3 · Tobias moderator 3 · Sol, Ada, Kel
     members 1 each — 14 in all, six people.
   · THE KICK (`decision:disavow_member`, ≥ 2/3 of the cast, ≥ 40% quorum,
     the subject excluded): five people have a say, 13 by role; the quorum is
     5.2. Mira (3) and Ada (1) have agreed — 4, short of 5.2 — so the card reads
     `2 of 5 so far`. The reader's Agree makes 5, still short; Juno's or
     Tobias's alone would carry it.
   · THE RENAME (`decision:set:metadata`, > 50% of the cast, ≥ 10% quorum):
     all six have a say, 14 by role; the quorum is 1.4. The reader's own ballot
     is 1, short of it, so their card reads `1 of 6 so far`; any one more voice
     carries it.
   · TOBIAS'S ROLE (`decision:change_role`) settled before the fixture opens;
     he wears `Moderator` on the member list and in the weights above. */
const SALT_CRUST = {
  name: "Salt-crust rubbings",
  policy: "invite",
  description: "Rubbings and prints from the flats, and the loft they dry in.",
};

const SALT_CRUST_MEMBERS = [
  { name: "Juno Baptiste", handle: "juno", role: "admin" },
  { name: "Mira Voss", handle: "mira", src: "inviter.jpg", role: "chat_mod" },
  { name: "Tobias Lindqvist", handle: "tobias", role: "chat_mod" },
  { name: "Sol Ferreira", handle: "sol", sub: "@sol · you", role: "member" },
  { name: "Ada Okonkwo", handle: "ada", role: "member" },
  { name: "Kel Moreau", handle: "kel", role: "member" },
];

const KICK_LINE = "Mira Voss wants to remove Kel Moreau from the chat";
const RENAME_LINE = "You want to rename the chat to “Salt prints”";

/* THE COUNT, IN PEOPLE, WITH THE ARITHMETIC UNDER IT. The face is the plain
   count; the exact tail says the weighted sum, the eligible total, the role
   weights and where it settles, and paints only in geek mode. */
const ROLE_WEIGHTS = "admin 5, moderator 3, member 1";

function PeopleSoFar({ agreed, of, sum, total, settles, share }) {
  return (
    <>
      {`${agreed} of ${of} so far`}
      <ExactTail
        exact={` · ${sum} of ${total} by role (${ROLE_WEIGHTS}) — settles at ${settles}, ${share} for`}
        spoken={`By role — ${ROLE_WEIGHTS} — ${sum} of ${total} so far; it settles at ${settles}, with ${share === "⅔" ? "two thirds" : share} for`}
      />
    </>
  );
}

const KICK_COUNT = <PeopleSoFar agreed={2} of={5} sum={4} total={13} settles="5.2" share="⅔" />;
const RENAME_COUNT = <PeopleSoFar agreed={1} of={6} sum={1} total={14} settles="1.4" share="over half" />;

/* THE BALLOT IN DISGUISE. `Agree` rides the end of the count's line, so it is
   the bare word (`InlineAction`'s own test: an act at the end of somebody
   else's line), never a pill — a thread of cards with filled buttons would be
   a thread of calls to action. ITS NAME CARRIES WHAT IT AGREES TO: two cards
   in one thread would otherwise be two identical `Agree`s to an ear. A tap
   signs one record in the reader's name — the send arrow's precedent, one
   record and one tap — and the slot then says `You agreed`, the quiet finished
   word (`Already removed`'s idiom), stated here, not drawn. `Approve` is the
   same act on a join request, worded for the one decision where the voice is
   an approver's. */
function AgreeAct({ what }) {
  return <InlineAction ariaLabel={`Agree — ${what}`}>Agree</InlineAction>;
}

function ApproveAct({ what }) {
  return <InlineAction ariaLabel={`Approve — ${what}`}>Approve</InlineAction>;
}

/* THE PENDING CARD — one decision waiting for more voices, in the transcript at
   the moment it was proposed.

   NEITHER A BUBBLE NOR A BANNER. A bubble belongs to a person (the reader's in
   `secondary-container` on the right, everyone else's in `surface-card` on the
   left); this is the chat's, so it takes neither fill and no side. It stands
   the column's full width on the page ground, bounded by the hairline at the
   bubbles' own corner — Material's outlined card, the one quiet container the
   thread does not already spend. No icon, no colour, no count of votes against
   a bar: nothing on it is louder than a message.

   ITS ANATOMY: the sentence, in the product's words and the proposer's name;
   a quoted line under it where the record carries one (a join request's
   message, the leave reason's grammar); and a count line — the people so far,
   then the act at its end where the reader has one. THE READER'S OWN CARD
   carries the count only: their ballot was signed with the proposal, so there
   is nothing left for them to press. A card whose gate is one approval (a join
   request under the default map) carries no count at all — `0 of 1` is noise,
   and the first approval settles it.

   NO CLOCK. The card is placed by its moment and the day divider dates it; a
   decision is not a message, and a time on it would ask when it ends — it
   never does. */
function PendingCard({ children, quote, count, act }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 4, padding: "12px 16px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-large)" }}>
      <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{children}</span>
      {quote && <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>“{quote}”</span>}
      {(count || act) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 24 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{count}</span>
          {act}
        </div>
      )}
    </div>
  );
}

/* THE OUTCOME LINE — what a pending card settles into when its tally crosses:
   one quiet centred sentence saying what is now true (`Tobias Lindqvist is now
   a moderator`, `Kel Moreau was removed`), in the day divider's register at
   body scale. IT SETTLES IN PLACE, at the proposal's moment — the lane's
   reading of "settling into", flagged: one fact, one line, and the transcript
   keeps its order. */
function DecisionOutcome({ children }) {
  return (
    <div style={{ alignSelf: "center", maxWidth: "88%", padding: "4px 0", textAlign: "center", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
      {children}
    </div>
  );
}

/* OPEN DECISIONS, FILLED — the same decisions the thread carries as cards,
   as compact rows under the section's label (`OpenDecisionsEmpty`'s place and
   label). A row reads what, then the count; where the reader has a voice, the
   act stands at its end.

   THE ROW SPLITS `RoleDoor`'s way (the stance row's grammar): the words are a
   door to the card in the thread, scrolled to its moment, and the act is its
   own target — never a control inside a control. The door's spoken name says
   where it goes. A row carries no act of its own for the reader's own
   proposal, as its card carries none; the words keep the full width then. */
function OpenDecisions({ rows }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column" }}>
      <SectionLabel>Open decisions</SectionLabel>
      {rows.map((r) => (
        <div key={r.what} style={{ display: "flex", alignItems: "stretch" }}>
          <button
            type="button"
            aria-label={`${r.what}, ${r.people} so far — see it in the chat`}
            className="cg-state cg-focus"
            style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, minHeight: "var(--touch-target-min)", border: 0, background: "none", padding: `var(--space-2) ${r.act ? "0" : "var(--space-6)"} var(--space-2) var(--space-6)`, cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" }}
          >
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{r.what}</span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{r.count}</span>
          </button>
          {r.act && <span style={{ flex: "none", display: "flex", alignItems: "center", padding: "0 24px 0 12px" }}>{r.act}</span>}
        </div>
      ))}
    </div>
  );
}

const SALT_CRUST_DECISIONS = [
  { what: KICK_LINE, people: "2 of 5", count: KICK_COUNT, act: <AgreeAct what={KICK_LINE} /> },
  { what: RENAME_LINE, people: "1 of 6", count: RENAME_COUNT },
];

/* THE SALT-CRUST THREAD — three days back, because the chats list reads its
   last message at `3d` and the transcript has to end where the list says it
   does: on Juno's line about the loft. Both open decisions sit in it at their
   own moments, and Tobias's settled role sits earlier, as its outcome line. */
function SaltCrustThread() {
  return (
    <ChatThreadColumn>
      <DayDivider>19 September</DayDivider>
      <ChatBubble author={CHAT_JUNO} when="17:30">
        First sheets are pegged up under the skylight.
      </ChatBubble>
      <DecisionOutcome>Tobias Lindqvist is now a moderator</DecisionOutcome>
      <DayDivider>20 September</DayDivider>
      <PendingCard count={KICK_COUNT} act={<AgreeAct what={KICK_LINE} />}>
        {KICK_LINE}
      </PendingCard>
      <ChatBubble author={CHAT_ADA} when="10:15">
        Two of the prints smudged overnight — the damp got in.
      </ChatBubble>
      <PendingCard count={RENAME_COUNT}>{RENAME_LINE}</PendingCard>
      <ChatBubble own when="11:02">
        Most of what we make now are prints — the name could say so.
      </ChatBubble>
      <ChatBubble author={CHAT_JUNO} when="11:40">
        The new rubbings are drying in the loft.
      </ChatBubble>
    </ChatThreadColumn>
  );
}

/* ── THE INVITED READER'S THREAD ─────────────────────────────────────────────
   Night fishing crew — invite only, the explorer's third row, its last message
   Tobias's and sealed. Mira has invited the reader. Drawn once because two
   boards draw it: the invitee's thread and the join's seal over it. The reader
   is not a member yet, so they hold no key: every sealed message is a notice. */
function NightFishingThread() {
  return (
    <ChatThreadColumn>
      <DayDivider>22 September</DayDivider>
      <ChatBubble author={CHAT_TOBIAS} when="21:40" sealed>
        <ChatSealedNotice />
      </ChatBubble>
      <ChatBubble author={CHAT_MIRA} when="21:52">
        The boat leaves the slipway at eleven if the wind drops.
      </ChatBubble>
      <DayDivider>23 September</DayDivider>
      <ChatBubble author={CHAT_KEL} when="06:10">
        Wind dropped. Four mackerel and a very cold hour.
      </ChatBubble>
      <ChatBubble author={CHAT_TOBIAS} when="06:30" sealed>
        <ChatSealedNotice />
      </ChatBubble>
    </ChatThreadColumn>
  );
}

function ChatThreadInvitedBody() {
  return (
    <>
      <ChatThreadHeader name="Night fishing crew" backLabel="Back" />
      <NightFishingThread />
      <ChatJoinFoot state="invited" invitedBy="Mira Voss" />
    </>
  );
}

/* A REMOVED CHAT VERSION — `ProfileVersionTombstone`'s shape at chat scale.
   Everything a chat version holds was its payload — the picture, the name, the
   words, who could join — so all of it goes and the mark stands in its place,
   beside the reserved disc a kept space wears. Nothing survives beside the
   disc, because nothing of a chat version lives outside it. The mark is the
   chat's own (`RedactedContent`'s `chat` reason): a chat has no author, and
   its members decided. */
function ChatVersionTombstone({ note }) {
  return (
    <Card>
      <MonogramAvatar name="" size="lg" redacted />
      <RedactedContent reason="chat" note={note} />
    </Card>
  );
}

/* THE CHAT'S EDIT HISTORY, WHOLE — drawn once because three boards draw it:
   the chronicle itself (`ChatHistory`), the removal's dialog over it
   (`ChatVersionRemoveConfirm`), and the chronicle after the removal passed
   (`ChatHistoryRemoved`, `removed`). The chronicle's reasons are
   `ChatHistory`'s docblock. `removed` tombstones the 10 September version in
   place — its row, its dateline and its date kept, the chat's own mark where
   its card stood, and `Already removed` in its act's slot. */
function ChatHistoryBody({ removed = false }) {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to chat details" />
      <HistoryColumn>
        <ChatEventRow who="Sol Ferreira" when="20 September">
          You invited Ada Okonkwo
        </ChatEventRow>
        <VersionBlock label="Current version · signed 18 September" action={<RemoveVersionAct />}>
          <ChatVersionCard {...COAST_WALKERS} />
        </VersionBlock>
        <ChatEventRow who="Sal Torres" when="14 September" reason="Moving inland for the winter. Thank you for the walks.">
          Sal Torres left
        </ChatEventRow>
        <ChatEventRow who="Harbour Rowing Club" when="12 September">
          Harbour Rowing Club joined
        </ChatEventRow>
        <ChatEventRow who="Mira Voss" src="inviter.jpg" when="11 September">
          Mira Voss invited Harbour Rowing Club
        </ChatEventRow>
        <VersionBlock label="Earlier version · signed 10 September" action={removed ? <AlreadyRemoved /> : <RemoveVersionAct />}>
          {removed ? (
            <ChatVersionTombstone note="A version stood here from 10 September. Its name, picture and words were removed; the record of the change stays." />
          ) : (
            <ChatVersionCard name="Coast walkers" policy="invite" description="Who is out on the flats, and when the crust holds." />
          )}
        </VersionBlock>
        <ChatEventRow who="Sal Torres" when="3 September">
          Sal Torres joined
        </ChatEventRow>
        <ChatEventRow who="Juno Baptiste" when="1 September">
          Juno Baptiste invited Sal Torres
        </ChatEventRow>
        <VersionBlock label="Earlier version · signed 24 August" action={<RemoveVersionAct />}>
          <ChatVersionCard name="Low-tide walks" policy="invite" description="Who is out on the flats, and when the crust holds." />
        </VersionBlock>
        <ChatEventRow who="Kel Moreau" when="23 August">
          Kel Moreau joined
        </ChatEventRow>
      </HistoryColumn>
    </>
  );
}
