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
  CograBand,
  FeedFilter,
  FilterTrigger,
  QuotedRow,
  NodeMark,
  STANCE_ANCHORS,
  Timeline,
  MoneyFigure,
  CgtMark,
  WalletBalance,
  LedgerRow,
  PayoutAddress,
  PayoutAddressRow,
  EarnedChart,
  SegmentedFilter,
  JoinPrompt,
} = components;

/* THE WALLET'S MOCK ADDRESSES — the wallet boards came across from canonical
   in the V1.0 scope cut (readme §13) and brought their two Liquid addresses
   with them: shape and length of a real confidential address, content
   invented. The rest, the zero wallet and the publish seal read the first;
   the change's seal reads both. */
const SOL_ADDRESS = "lq1qq2xvpcvfup5j8zscjq05eqylmrc6javzn30v78y7255695yz4t9r5v5m8g6snm4gvsvvzp6mzurcem6ms70epwqmwtnw2pex";
const SOL_ADDRESS_NEW = "lq1qqw7t3xk0zfvljmv2u49h5tld6mfj7z2vhnn0mjcz2q0edgp5yh3l5wxk8m9dqrrf0e2h4t8ur5cem2n970q4wsxm5u8f30a";

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
   not drawn.

   AN INVITED READER'S ROW WEARS ITS OWN WORD (the chats integration round,
   2026-09-24): `You're invited`, in the join's register — an `InlineAction`,
   because it is an act — standing where `Join`, `Ask to join` or `Invite only`
   would. It says the one fact that changes what the reader can do here: an
   invite-only chat is shut to a stranger and open to them. The tap lands where
   `Join` lands, the join's seal, on the invited route's nouns (`Invited by` ·
   the inviter) — the invitation read back before anything is signed. The
   word's candidates are copy-voice's. */
const JOIN_WORD = {
  open: <InlineAction size="sm">Join</InlineAction>,
  request: <InlineAction size="sm">Ask to join</InlineAction>,
  invited: <InlineAction size="sm">You're invited</InlineAction>,
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
   bubble, so the badge does.

   THE INTEGRATION ROUND'S FIVE ADDITIONS (2026-09-24), each drawing nothing
   when absent, so every earlier board renders exactly as it did:
   · `quote` — the message this one replies to, at the bubble's head
     (`BubbleQuote`);
   · `trace` — the opinions already cast on it, under the bubble
     (`ReactionTrace`); an array of pairs;
   · `pending` — the product's pending grammar at chat scale: `Still
     settling` before the clock, in the time's own ink;
   · `removed` — the bubble becomes the removal mark (`RemovedBubble`);
   · `fill` — the full 78% a piece of media takes, for a no-key tile, which
     carries no `media` of its own;
   · `voice` — a voice note, `{ length, description }`, drawn compact by
     `VoiceNote` with the clock on its own second line's end.

   THE TIMESTAMP TUCK (jakob's canvas review, the fix pass — he first saw the
   excess on Juno's "office." line). When a message is words and its last line
   is short, the clock TUCKS INTO THAT LINE, at the bubble's lower right and
   sitting marginally lower than the words — WhatsApp's way; only a last line
   too long to share pushes the clock to a line of its own. It is built the
   standard way: an invisible copy of the clock ends the text as an inline
   spacer, so the last line reserves exactly the clock's width or wraps it
   away, and the visible clock is laid at the bubble's corner over that
   reserved room. A bubble whose content is not plain words — a notice, a
   sent post, a no-key tile — keeps the clock on its own line under it. */
function BubbleStamp({ sealed, pending, when, ink, spacer = false }) {
  return (
    <span
      aria-hidden={spacer ? "true" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        color: ink,
        ...(spacer ? { visibility: "hidden", marginLeft: 8, verticalAlign: "top" } : {}),
      }}
    >
      {sealed && (
        <span role={spacer ? undefined : "img"} aria-label={spacer ? undefined : "End-to-end encrypted"} style={{ display: "inline-flex" }}>
          <Icon name="lock" size={12} />
        </span>
      )}
      {pending && <span>Still settling ·</span>}
      {when}
    </span>
  );
}

/* `avatar={false}` drops the face beside a foreign bubble and keeps its tail —
   for a bubble whose sender is already named by what holds it (the message
   feed card's author line, the final micro-fix). `onCard` lifts a foreign
   bubble's fill one tonal step (`surface-container-high`) where it stands on a
   card rather than on the page ground: the thread's `surface-card` bubble on a
   `surface-card` card would vanish into it — the lane's call, flagged. */
function ChatBubble({ own = false, author, first = true, last = true, when, sealed = false, media, id, quote, trace, pending = false, removed, fill = false, voice, avatar = true, onCard = false, children }) {
  if (removed) return <RemovedBubble own={own} author={author} first={first} last={last} when={when} id={id} {...removed} />;
  const ink = own ? "var(--text-body)" : "var(--text-secondary)";
  const tail = own ? { borderBottomRightRadius: "var(--radius-extra-small)" } : { borderBottomLeftRadius: "var(--radius-extra-small)" };
  const stamp = { sealed, pending, when, ink };
  const tuck = typeof children === "string";
  const row = (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
      {!own && avatar && (last ? <MonogramAvatar name={author.name} src={author.src} size="md" /> : <span style={{ flex: "none", width: 32 }} />)}
      <div
        data-message={id}
        style={{
          position: "relative",
          maxWidth: "78%",
          width: media || fill || voice ? "78%" : undefined,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "8px 12px",
          borderRadius: "var(--radius-large)",
          ...(last ? tail : {}),
          background: own ? "var(--secondary-container)" : onCard ? "var(--surface-container-high)" : "var(--surface-card)",
          color: "var(--text-body)",
        }}
      >
        {!own && first && (
          <span style={{ fontSize: "var(--text-label-medium)", lineHeight: "var(--text-label-medium--line-height)", fontWeight: "var(--text-label-medium--font-weight)" }}>
            {author.name}
          </span>
        )}
        {quote && <BubbleQuote {...quote} />}
        {media && (
          <div style={{ margin: "4px 0 2px" }}>
            <MediaAttachment {...media} radius="var(--radius-medium)" maxHeight="220px" />
          </div>
        )}
        {voice ? (
          <VoiceNote {...voice} stamp={<BubbleStamp {...stamp} />} />
        ) : tuck ? (
          <>
            <div style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              {children}
              <BubbleStamp {...stamp} spacer />
            </div>
            <span style={{ position: "absolute", right: 12, bottom: 4 }}>
              <BubbleStamp {...stamp} />
            </span>
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              {children}
            </div>
            <span style={{ alignSelf: "flex-end", display: "inline-flex" }}>
              <BubbleStamp {...stamp} />
            </span>
          </>
        )}
      </div>
    </div>
  );
  if (!trace) return row;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: own ? "flex-end" : "flex-start" }}>
      {row}
      <div style={{ marginTop: -6, padding: own ? "0 8px 0 0" : "0 0 0 48px", maxWidth: "78%", boxSizing: "border-box" }}>
        <ReactionTrace pairs={trace} />
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
   list above it collapses; the thread does not.

   IT IS `PageHeader`, MOUNTED (the componentization law, the integration
   round's fix pass): the band, the back link and the trailing action are the
   master's own, the door rides the master's title slot and the search glyph
   its action slot. The name therefore reads at the page title's size, the
   house's one header type. The door's disc is `ChatDisc`. */
function ChatThreadHeader({ name, image, backLabel = "Back to your chats" }) {
  return (
    <PageHeader
      backHref="#"
      backLabel={backLabel}
      title={
        <button
          type="button"
          aria-label={`${name} — chat details`}
          className="cg-state cg-focus"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 48, padding: "0 var(--space-2)", border: 0, background: "none", borderRadius: "var(--radius-medium)", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}
        >
          <ChatDisc image={image} size={32} />
          <span>{name}</span>
        </button>
      }
      action={
        <button
          type="button"
          aria-label="Search in this chat"
          className="cg-state cg-focus"
          style={{ height: 48, width: 48, flex: "none", display: "grid", placeItems: "center", border: 0, padding: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <Icon name="search" />
        </button>
      }
    />
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

/* THE MIC STANDS WHERE THE ARROW STANDS WHILE THE FIELD IS EMPTY (the chats
   integration round, 2026-09-24 — WhatsApp's grammar, the lane's call,
   flagged). An empty field has nothing for the arrow to sign, so the slot
   carries the voice note instead; the first typed character swaps the arrow
   back. The alternative — the mic always beside the arrow — costs the field
   48px on every thread for a control that is useless the moment there are
   words. A TAP STARTS THE RECORDING (jakob's ruling, the final micro-fix):
   the foot becomes the recording's controls (`ChatFootRecording`) — no hold,
   no slide, no release that signs; the note is signed only by the recording
   foot's own send arrow. The mic wears the arrow's filled `primary` disc
   because it holds the arrow's place. */
function MicSeal() {
  return (
    <button
      type="button"
      aria-label="Record a voice message"
      className="cg-state cg-focus cg-hit"
      style={{ display: "grid", placeItems: "center", width: 40, height: 40, flex: "none", border: 0, padding: 0, background: "var(--primary)", color: "var(--on-primary)", borderRadius: "var(--radius-full)", cursor: "pointer" }}
    >
      <Icon name="mic" size={20} />
    </button>
  );
}

function ChatFoot({ draft = "", sealed = false, firstSend = false, quote }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 16px", borderTop: "1px solid var(--border-hairline)" }}>
      {quote && <ReplyQuoteStrip {...quote} />}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <FieldAligned>
          <LockToggle on={sealed} />
        </FieldAligned>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField label="Message" rows={1} value={draft} />
        </div>
        <FieldAligned>{draft ? <SendSeal /> : <MicSeal />}</FieldAligned>
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
     the transcript's outcome line directly above it says why.

   THE INVITATION'S OWN WORDS RIDE THE INVITED FOOT (the chats integration
   round, 2026-09-24). An Invitation carries its inviter's optional message as
   payload (chats.md §4, *Invite flow*), written on the invite seal
   (`ChatInviteSeal`); where there is one, `invitationMessage` stands quoted
   under the line that names the inviter — the leave reason's grammar, the
   inviter's own words in their own quotation marks. */
function ChatJoinFoot({ policy = "request", state, invitedBy, invitationMessage }) {
  const join = <Button style={{ width: "100%" }}>Join</Button>;
  let body;
  if (state === "invited") {
    body = (
      <>
        <QuietNote>{`${invitedBy} invited you.`}</QuietNote>
        {invitationMessage && (
          <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-body)" }}>“{invitationMessage}”</span>
        )}
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

/* The reader's own words on their request to join Harbour office — typed in
   the request's sheet (`ChatAskSheet`), quoted on their own card
   (`ChatThreadRequested`). */
const HARBOUR_REQUEST_MESSAGE = "The blue wool hat is mine — and I'd like to help with the lost-and-found.";

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

/* THE CHAT A SEAL IS ABOUT, SHOWN BACK AT ITS TOP — the disc and the name
   over one line saying what is being signed, as the founding, the edit and the
   invitation seals each drew it by hand before the componentization audit
   (the integration round's fix pass) made it one drawing. `ProfileEditSeal`'s
   own head, one kind over; no design-system master draws it. */
function ChatSealSubject({ image, name, line }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <ChatDisc image={image} size={64} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>{name}</span>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>{line}</span>
      </span>
    </div>
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
   detail surface to open (the profile chronicle's precedent).

   `pictureDoor` (the governance round's decision page, jakob 2026-09-24): a
   PROPOSED version's picture must be judgeable before anyone votes on it, so
   there it rides the card at the details' own 80px — the largest size the
   chat's picture ever takes, which is how it will actually be seen — and the
   disc is a door to the fullscreen viewer, the product's second-tap grammar
   for media. Every other version card keeps the chronicle's inert 64px. */
function ChatVersionCard({ name, image, policy, description, pictureDoor = false }) {
  const disc = pictureDoor ? (
    <button
      type="button"
      aria-label="Open the proposed picture"
      className="cg-state cg-focus"
      style={{ flex: "none", border: 0, padding: 0, background: "none", borderRadius: "var(--radius-full)", cursor: "pointer" }}
    >
      <ChatDisc image={image} size={80} />
    </button>
  ) : (
    <ChatDisc image={image} size={64} />
  );
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {disc}
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

   Round B2 of the chats work (jakob's rulings 2026-09-23, and his fix-pass
   rulings 2026-09-24): the multi-voice acts the details round left as
   intended gaps — the pending card and the filled `Open decisions`, the
   decision opened whole, the vote's own small seal, the invitation into an
   existing chat, the join in its three routes, the request's two sides, the
   role change and a version's removal.

   THE LAW (jakob 2026-09-23). A chat's backbone is the proposal machinery, and
   NOTHING MAY LOOK LIKE A PROPOSAL. An act whose actor's own say clears its
   gate is INSTANT: it is a proposal passing on its proposer's first ballot, so
   its seal counts the anchor, its reference to the subject and the proposer's
   own ballot — `3 things, signed together`, `ChatEditSeal`'s precedent. An act
   that needs more voices becomes a QUIET PENDING CARD IN THE THREAD, at the
   moment it was proposed: a plain sentence (`Mira Voss wants to remove Kel
   Moreau from the chat`), `Agree` and `Disagree`, and a plain count of the
   PEOPLE who agree (`2 of 5 so far`). The card opens the decision whole
   (`ChatDecisionDetail`). When the tally settles, the card becomes its outcome
   line. The same open decisions stand as rows under `Open decisions` on the
   details. Proposals never expire, so no card carries a clock or a deadline.

   A VOTE BOTH WAYS IS A REAL VOTE (jakob 2026-09-24; governance.md §2.4 and
   §3). A ballot's direction is its sign — positive agrees, negative disagrees,
   zero withdraws — and every chat threshold reads the CAST: `> 50% of the
   cast`, `≥ 2/3 of the cast`, each beside a quorum of the eligible weight that
   has cast (chats.md §5). So a disagreement moves passage twice over: it counts
   toward the quorum and it counts against the share. AND CHAT TALLIES ARE
   BIDIRECTIONAL, WITH MIRROR FAILURE (governance.md §2.4, *Mirror failure
   (bidirectional tallies)*): a decision FAILS, terminally, the moment its
   negative side satisfies the same threshold shape — the same quorum, the
   same fraction, over the weight against; while neither side crosses it stays
   open and members may vote again. The positive-only petition tally is
   Network-scope only (governance.md §3, *Petition-style tally and dual quorum
   (Network-scope only)*) and never a chat's. So an outcome line has two
   faces: what passed (`Tobias Lindqvist is now a moderator`) and what failed
   (`The chat kept its name`). A failed decision is final; asking again is a
   new proposal (governance.md §3, *Counter-Proposals*).

   NO VOTE SIGNS ON A BARE TAP (jakob 2026-09-24: no misclicks). `Agree`,
   `Disagree` and `Approve` open the vote's own small seal (`VoteSheet`,
   drawn once as `ChatAgreeSheet`): one sentence saying what the vote is, and the
   seal's button. Changing a vote and withdrawing it go through the same sheet
   from the decision's own page.

   THE COUNT CONVENTION — the brief's recommendation, flagged for jakob's
   canvas review. A card counts the PEOPLE who agree and never shows weight:
   `2 of 5` is two of the five who have a say. The tally underneath is weighted
   (the default map: admin 5, moderator 3, member 1; chats.md §5), so a card
   can settle "early" — at 3 of 5, if an admin is among the three — or fail
   while its count still reads well, because disagreement weighs too; it
   simply settles when it settles. The card carries no arithmetic at all: THE
   EXACT VOTES, BOTH WAYS, LIVE ON THE DECISION'S OWN PAGE, and geek mode paints
   the weighted sums there in the geek-pair grammar (`ExactTail`) — a widening
   of the geek round's "the pairs, and only the pairs" to a governance tally,
   named here because it is a widening and not a reading. */

/* THE DECISIONS CHAT — Salt-crust rubbings, where the reader is a plain
   member. The fixture moved off Coast walkers ON PURPOSE: there the reader is
   the founder and admin, and an admin's own say clears the metadata gate in
   any chat this size (``decision:set:metadata``: > 50% of the cast, a 10% quorum
   — 5 of Coast walkers' 12 is 42%), so the reader's own pending change the
   round needs cannot honestly stand there. Here the reader weighs 1.

   THE ARITHMETIC, checkable by hand (chats.md §5, the default map; quorum is
   the share of the eligible weight that has cast, governance.md §2.4; mirror
   failure as above):
   · Juno admin 5 · Mira moderator 3 · Tobias moderator 3 · Sol, Ada, Kel
     members 1 each — 14 in all, six people.
   · THE KICK (`decision:disavow_member`, ≥ 2/3 of the cast, ≥ 40% quorum,
     the subject excluded): five people have a say, 13 by role; the quorum is
     5.2. Mira (3) and Ada (1) agree — 4 cast, short of 5.2 — so it is open and
     the card reads `2 of 5 so far`. The reader's vote either way makes 5 cast,
     still short. Juno agreeing would carry it (9 cast, all for); Tobias
     disagreeing would not end it (7 cast, 4 for and 3 against, neither side at
     two thirds).
   · THE CHANGE (``decision:set:metadata``, > 50% of the cast, ≥ 10% quorum): a
     new name, a new picture and a new description in one decision. All six
     have a say, 14 by role; the quorum is 1.4. The reader (1), Ada (1) and Kel
     (1) agree; Mira (3) disagrees. 6 cast, past the quorum, and it stands at
     exactly half each way — neither side past half — so it is open, and the
     card reads `3 of 6 so far`. The next vote decides it: one more agreement
     passes it, one more disagreement fails it.
   · EARLIER, 19 SEPTEMBER: a rename to the name alone failed — its negative
     side crossed first — and Tobias's role change (`decision:change_role`)
     passed; he wears `Moderator` on the member list and in the weights above. */
const SALT_CRUST = {
  name: "Salt-crust rubbings",
  policy: "invite",
  description: "Rubbings and prints from the flats, and the loft they dry in.",
};

/* The version the reader's own change proposes — whole: a picture (a member
   raising the film camera the prints come from), the name and the words. */
const SALT_PRINTS = {
  name: "Salt prints",
  image: "comment-camera.jpg",
  policy: "invite",
  description: "Prints and rubbings from the salt flats — who is printing, what came out, and when the loft is open.",
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
const CHANGE_LINE = "You want to change the chat's name, picture and description";
const ROLE_WEIGHTS = "admin 5, moderator 3, member 1";

/* THE VOTE'S TWO WORDS, ON A CARD AND ON A ROW. Both are present (jakob
   2026-09-24) and weighted like the dialog's two answers — the house's own
   grammar for a pair of answers: `Disagree` the quiet text button, `Agree` the
   filled small button on the right. The lane's styling call, flagged: filled
   rather than tonal, because the system's button carries no tonal variant and
   the dialog's pair is the pair a thumb already knows. EACH NAME CARRIES WHAT
   IT VOTES ON — two cards in one thread would otherwise be two identical pairs
   to an ear. Neither signs on the tap: each opens the vote's small seal
   (`ChatAgreeSheet`). `Approve`, on a join request, is the filled word alone —
   a request under the default map has no against: ignoring it is the no, and
   it needs no record (layer1-interface.md §9.8). */
function VoteActs({ what }) {
  return (
    <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Button variant="text" size="sm" ariaLabel={`Disagree — ${what}`}>
        Disagree
      </Button>
      <Button size="sm" ariaLabel={`Agree — ${what}`}>
        Agree
      </Button>
    </span>
  );
}

function ApproveAct({ what }) {
  return (
    <Button size="sm" ariaLabel={`Approve — ${what}`} style={{ flex: "none" }}>
      Approve
    </Button>
  );
}

/* THE PENDING CARD — one decision waiting for more voices, in the transcript at
   the moment it was proposed.

   NEITHER A BUBBLE NOR A BANNER. A bubble belongs to a person (the reader's in
   `secondary-container` on the right, everyone else's in `surface-card` on the
   left); this is the chat's, so it takes neither fill and no side. It stands
   the column's full width on the page ground, bounded by the hairline at the
   bubbles' own corner — Material's outlined card, the one quiet container the
   thread does not already spend. No icon, no colour, no bar filling towards a
   threshold: nothing on it is louder than a message.

   ITS ANATOMY: the sentence, in the product's words and the proposer's name,
   with a quoted line under it where the record carries one (a join request's
   message, the leave reason's grammar) — THE WORDS ARE A DOOR to the decision
   whole (`ChatDecisionDetail`, jakob 2026-09-24), split from the acts
   `RoleDoor`'s way so no control stands inside another. Under them, the count
   line: the people who agree so far, then the vote's two words where the
   reader has not voted.

   A CARD THE READER HAS VOTED ON WEARS A READOUT, NOT A BUTTON (jakob
   2026-09-24). The two words give way to the quiet `You agreed` or `You
   disagreed` — `ChatRowWord`'s finished-act register, `Already removed`'s
   idiom — and the WHOLE CARD, words and readout together, becomes the one
   door to the decision page, where changing and taking back a vote live.
   Cards stay calm; the page is where a vote is revised. THE READER'S OWN CARD
   is always in this state: their agreement was signed with the proposal. The
   lane's layout call, flagged: the readout stands where the buttons stood, at
   the count line's end, so a voted card and an unvoted one keep one shape.

   A card whose gate is one approval (a join request under the default map)
   carries no count — `0 of 1` is noise, and the first approval settles it.

   NO CLOCK. The card is placed by its moment and the day divider dates it; a
   decision is not a message, and a time on it would ask when it ends — it
   never does. */
function PendingCard({ children, quote, count, act, voted }) {
  if (voted) {
    return (
      <button
        type="button"
        aria-label={`${children}, ${count}, ${voted} — see the decision`}
        className="cg-state cg-focus"
        style={{ flex: "none", display: "flex", flexDirection: "column", gap: 4, padding: "12px 16px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-large)", background: "none", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" }}
      >
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{children}</span>
        <span style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 12, minHeight: 32 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{count}</span>
          <ChatRowWord>{voted}</ChatRowWord>
        </span>
      </button>
    );
  }
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 4, padding: "4px 8px 8px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-large)" }}>
      <button
        type="button"
        aria-label={`${children} — see the decision`}
        className="cg-state cg-focus"
        style={{ display: "flex", flexDirection: "column", gap: 4, border: 0, background: "none", padding: "8px 8px 0", borderRadius: "var(--radius-medium)", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" }}
      >
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{children}</span>
        {quote && <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>“{quote}”</span>}
      </button>
      {(count || act) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 32, padding: "0 0 0 8px" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{count}</span>
          {act}
        </div>
      )}
    </div>
  );
}

/* THE OUTCOME LINE — what a pending card becomes when its tally settles: one
   quiet centred sentence saying what is now true, in the day divider's
   register at body scale. TWO FACES, because chat tallies are bidirectional:
   PASSED says the change (`Tobias Lindqvist is now a moderator`, `Kel Moreau
   was removed`); FAILED says what stayed (`The chat kept its name`, `Kel
   Moreau stays in the chat`) — never "rejected" or "voted down", because
   what a reader needs is the state of the chat, not the verdict's verb. IT
   SETTLES IN PLACE, at the proposal's moment — the lane's reading of
   "settling into", flagged: one fact, one line, and the transcript keeps its
   order. The line still opens the decision whole: a settled decision's votes
   stay public. */
function DecisionOutcome({ children }) {
  return (
    <div style={{ alignSelf: "center", maxWidth: "88%", padding: "4px 0", textAlign: "center", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
      {children}
    </div>
  );
}

/* OPEN DECISIONS, FILLED — the same decisions the thread carries as cards,
   as rows under the section's label (`OpenDecisionsEmpty`'s place and label).

   A ROW IS THE CARD WITHOUT ITS OUTLINE: the words a door to the decision
   whole (`ChatDecisionDetail`), the count under them, and — where the reader
   has a voice — the vote's two words on a line of their own at the row's
   right edge. The two words cannot share the words' line on a phone without
   crushing the sentence to a column, so they take the line under it; the
   door and the acts stay separate targets, never a control inside a control.
   The door's spoken name says where it goes. A row the reader has voted on
   — their own proposal always — carries the card's readout (`You agreed`) at
   the count line's end, INSIDE the door: words and readout open the decision
   page together, where the vote is revised. */
function OpenDecisions({ rows }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column" }}>
      <SectionLabel>Open decisions</SectionLabel>
      {rows.map((r) => (
        <div key={r.what} style={{ display: "flex", flexDirection: "column" }}>
          <button
            type="button"
            aria-label={`${r.what}, ${r.count}${r.voted ? `, ${r.voted}` : ""} — see the decision`}
            className="cg-state cg-focus"
            style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, minHeight: "var(--touch-target-min)", border: 0, background: "none", padding: "var(--space-2) var(--space-6)", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" }}
          >
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{r.what}</span>
            <span style={{ alignSelf: "stretch", display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{r.count}</span>
              {r.voted && <ChatRowWord>{r.voted}</ChatRowWord>}
            </span>
          </button>
          {r.act && <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 24px 4px" }}>{r.act}</div>}
        </div>
      ))}
    </div>
  );
}

const SALT_CRUST_DECISIONS = [
  { what: KICK_LINE, count: "2 of 5 so far", act: <VoteActs what={KICK_LINE} /> },
  { what: CHANGE_LINE, count: "3 of 6 so far", voted: "You agreed" },
];

/* THE SALT-CRUST THREAD — three days back, because the chats list reads its
   last message at `3d` and the transcript has to end where the list says it
   does: on Juno's line about the loft. Both open decisions sit in it at their
   own moments; 19 September holds two settled ones, one of each face — the
   name-only rename that failed, and Tobias's role change that passed. */
function SaltCrustThread() {
  return (
    <ChatThreadColumn>
      <DayDivider>19 September</DayDivider>
      <DecisionOutcome>The chat kept its name</DecisionOutcome>
      <DecisionOutcome>Tobias Lindqvist is now a moderator</DecisionOutcome>
      <DayDivider>20 September</DayDivider>
      <PendingCard count="2 of 5 so far" act={<VoteActs what={KICK_LINE} />}>
        {KICK_LINE}
      </PendingCard>
      <ChatBubble author={CHAT_ADA} when="10:15">
        Two of the prints smudged overnight — the damp got in.
      </ChatBubble>
      <PendingCard count="3 of 6 so far" voted="You agreed">
        {CHANGE_LINE}
      </PendingCard>
      <ChatBubble own when="11:02">
        Most of what we make now are prints — the chat could say so, and show one.
      </ChatBubble>
      <ChatBubble author={CHAT_JUNO} when="11:40">
        The new rubbings are drying in the loft.
      </ChatBubble>
    </ChatThreadColumn>
  );
}

/* THE DECISIONS THREAD, WHOLE — drawn once because two boards draw it: the
   thread itself and the vote's sheet over it (`ThreadDetail`'s rule). */
function ChatThreadDecisionsBody() {
  return (
    <>
      <ChatThreadHeader name="Salt-crust rubbings" />
      <SaltCrustThread />
      <ChatFoot />
    </>
  );
}

/* ── THE DECISION, WHOLE ──────────────────────────────────────────────────────
   `ChatDecisionDetail`'s parts. The votes are people's public records, read
   individually (api-spec.md, `Proposal.ballots`: "public and auditable"), so a
   vote row is the member list's person row — `ReferenceRow` at person kind,
   the date the vote was signed under the name, and which way it went on the
   trailing edge in the row's plain-value slot. A tap opens the person. */
function VoteRows({ votes }) {
  return votes.map((v) => (
    <ReferenceRow key={v.handle} kind="person" name={v.name} src={v.src} sub={v.sub} value={v.way} onOpen={() => {}} />
  ));
}

const CHANGE_VOTES = [
  { name: "Mira Voss", handle: "mira", src: "inviter.jpg", sub: "21 September", way: "Disagreed" },
  { name: "Kel Moreau", handle: "kel", sub: "20 September", way: "Agreed" },
  { name: "Ada Okonkwo", handle: "ada", sub: "20 September", way: "Agreed" },
  { name: "Sol Ferreira", handle: "sol", sub: "you · 20 September", way: "Agreed" },
];

/* THE VOTE'S OWN SMALL SEAL (jakob 2026-09-24: no vote signs on a bare tap —
   no misclicks). `ChatSignSheet`'s vocabulary compressed to what one vote
   needs: the sheet's title and the seal's "?", ONE SENTENCE saying what the
   vote is, one quiet line saying it is public and can be changed, and the
   seal's own button at full width, its verb naming the act. No acts card: a
   vote is one record, and a card counting `1 thing` would be the only thing
   on it.

   ONE MASTER FOR EVERY VOTE; THE NOUNS SWAP, NOTHING ELSE MOVES (the confirm
   grammar):
   · Agree — `You agree that Kel Moreau should be removed from the chat.` ·
     `Sign and agree` (drawn, `ChatAgreeSheet`);
   · Disagree — `You disagree that Kel Moreau should be removed from the
     chat.` · `Sign and disagree`;
   · Approve — `You approve Sal Torres joining the chat.` · `Sign and approve`;
   · a changed vote — the new direction's sentence, the same two buttons;
   · withdrawing — `You take back your vote on changing the chat's name,
     picture and description.` · `Sign and withdraw`.
   Each signs one ballot record (governance.md §3): positive, negative, or —
   for a withdrawal — the zero-direction ballot. */
function VoteSheet({ sentence, sign }) {
  return (
    <BottomSheet open ariaLabel="What you sign">
      <SheetTitle trailing={<HelpDot ariaLabel="How signing works" />}>What you sign</SheetTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 8px" }}>
        <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>{sentence}</p>
        <QuietNote>Your vote is public, and it is yours to change or take back later.</QuietNote>
        <Button style={{ width: "100%" }}>{sign}</Button>
      </div>
    </BottomSheet>
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
      <ChatJoinFoot state="invited" invitedBy="Mira Voss" invitationMessage={NIGHT_FISHING_INVITATION} />
    </>
  );
}

/* Mira's words on the invitation — written on the invite seal's optional
   field; the invited foot, the notification row and the join's seal all read
   the same line. */
const NIGHT_FISHING_INVITATION = "We go out when the wind drops — you said you'd like to try.";

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

/* ══ THE CHATS INTEGRATION ROUND ═════════════════════════════════════════════

   Round B3 of the chats work (jakob's rulings 2026-09-23/24), and the round
   that closes it: what a chat owes the rest of the product, and what the
   rest of the product owes a chat. Opinions on a message shown back as a
   trace; voice notes; the faces an encrypted attachment wears; the chat and
   the message as feed cards; a chat in search, a message in Saved; the reply's
   quote; a post sent into a chat; the pending and the unlanded message; the
   removed message; the chat notifications; the two small composers.

   STILL MESSENGER CLOTHES. Every addition below is a messenger convention a
   reader already owns — the reaction under a bubble, the held mic, the quote
   above a reply, the share sheet's row of conversations — carried over CoGra's
   own records, never a new kind of record. */

/* ── THE REPLY ───────────────────────────────────────────────────────────────

   `Reply` on a message's acts (`ChatMessageMenu`) puts the quote on the foot:
   the message being answered, held above the field (`ReplyQuoteStrip`). What
   the reader then sends is a new message in this chat carrying a Reference to
   the one it answers (chats.md §3 — quoting from a message is a Reference with
   the message as citing artifact). Landed, the quote rides the head of the new
   bubble (`BubbleQuote`), a tap away from the message it answers.

   THE STRIP IS `QuotedRow`, the composer's own "thing being answered" — the
   reply composer's block, one level down. It is contained and inert, as that
   master's charter says; its one control is the × beside it, which lets the
   reply go and leaves the words in the field. */
function ReplyQuoteStrip({ name, snippet, src }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <QuotedRow title={`Replying to ${name}`} snippet={snippet} name={name} src={src} />
      </div>
      <button
        type="button"
        aria-label="Cancel the reply"
        className="cg-state cg-focus cg-hit"
        style={{ display: "grid", placeItems: "center", width: 40, height: 40, flex: "none", border: 0, padding: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer" }}
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

/* THE QUOTE AT A BUBBLE'S HEAD — the message a reply answers, in the tonal
   step above either bubble fill (`surface-container-highest`, `QuotedRow`'s
   own tone), its sender's name and one ellipsized line. A DOOR: it scrolls the
   thread to the message it quotes, and says so for the ear. Where the quoted
   message is encrypted and the reader holds no key, the line is `An encrypted
   message` — the preview rule (`NoKeyPreview`), stated, not drawn.

   IT IS `QuotedRow`, MOUNTED (the componentization law, the fix pass) — the
   strip's own master, inside the door that makes it pressable, so the quote a
   reader composes against and the quote they read back are one drawing. */
function BubbleQuote({ name, snippet, src }) {
  return (
    <button
      type="button"
      aria-label={`Replying to ${name}: ${snippet} — go to the message`}
      className="cg-state cg-focus"
      style={{ display: "block", margin: "2px 0 4px", padding: 0, border: 0, borderRadius: "var(--radius-small)", background: "none", color: "var(--text-body)", fontFamily: "var(--font-sans)", textAlign: "left", cursor: "pointer", minWidth: 0 }}
    >
      <QuotedRow title={name} snippet={snippet} name={name} src={src} />
    </button>
  );
}

/* ── THE REACTION TRACE ──────────────────────────────────────────────────────

   REACTIONS ARE THE OPINIONS ALREADY CAST ON A MESSAGE (jakob 2026-09-24: "we
   add them just like with whatsapp.. its cool to have"). NO NEW RECORD KIND
   AND NO EMOJI SYSTEM: a message is first-class content (chats.md §1) and
   every Opinion → Message already carries a pair, which the twenty faces
   already read. So the trace is a READOUT, never a picker — it draws what is
   there, and giving one's own opinion stays the message menu's `Give your
   opinion`, the ordinary pad.

   WHATSAPP'S SHAPE: a quiet pill hanging from the bubble's lower edge, the
   faces AGGREGATED — each person's opinion read as the nearest of the twenty
   (`nearestAnchor`), the most-worn faces first, at most three — and the count
   of PEOPLE beside them. Each person counts once however many picks their
   opinion is built from: the trace answers "how did people take this", and a
   sum of records would be a different question.

   THE CARD'S RULE BENDS ONCE, AND ONLY THIS FAR. Round A ruled that a bubble
   carries content, time and the lock and nothing else. The trace hangs
   OUTSIDE the bubble, on the page ground, in `text-secondary` — never a
   control on the bubble, never a number on it — and it appears only where
   someone has an opinion; a message nobody answered is exactly as bare as
   before.

   A TAP OPENS `Opinions on this` — the message menu's existing destination,
   canonical's opinions sheet, with the whole list, each row splitting to its
   own timeline.

   GEEK MODE PAINTS THE PAIRS (the geek round's "the pairs, and only the
   pairs"): a `cg-exact` tail after the count, each person's pair in the
   pad's order, the first three and then `+N more` — the sheet holds the rest.
   The lane's reading of the grammar for an aggregate, flagged: the pairs are
   the individual opinions the faces stand for, never an average, which would
   be a number no one signed. The spoken name carries the faces' words and the
   pairs in both modes.

   TWO HELPERS SPELLED HERE, because a board reaches the bundle's components
   and not its helpers (canonical's `SR_ONLY` precedent): `nearestAnchor`'s
   walk and `formatStancePair`'s form, both over the exposed `STANCE_ANCHORS`
   table and the system's one number format — the same table, read the same
   way, never a second one. */
function traceAnchor(pair) {
  let best = STANCE_ANCHORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of STANCE_ANCHORS) {
    const dd = anchor.pDirected - pair.pDirected;
    const di = anchor.pInterest - pair.pInterest;
    const distance = dd * dd + di * di;
    if (distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

const TRACE_DIMENSION = new Intl.NumberFormat("en-US", { signDisplay: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const traceDimension = (value) =>
  TRACE_DIMENSION.formatToParts(value)
    .map((part) => (part.type === "minusSign" ? "−" : part.value))
    .join("");
const formatStancePair = (pair) => `${traceDimension(pair.pDirected)} / ${traceDimension(pair.pInterest)}`;

function traceFaces(pairs) {
  const tally = new Map();
  pairs.forEach((pair, index) => {
    const anchor = traceAnchor(pair);
    const row = tally.get(anchor.emoji) ?? { anchor, n: 0, first: index };
    row.n += 1;
    tally.set(anchor.emoji, row);
  });
  return [...tally.values()].sort((a, b) => b.n - a.n || a.first - b.first).slice(0, 3);
}

function ReactionTrace({ pairs }) {
  const faces = traceFaces(pairs);
  const people = pairs.length;
  const shown = pairs.slice(0, 3).map(formatStancePair);
  const more = people > 3 ? ` · +${people - 3} more` : "";
  const exact = `${shown.join(" · ")}${more}`;
  const spoken = `Opinions on this — ${people} ${people === 1 ? "person" : "people"}: ${faces.map((f) => f.anchor.label).join(", ")}; ${exact}. See who`;
  return (
    <button
      type="button"
      aria-label={spoken}
      className="cg-state cg-focus cg-hit"
      style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", columnGap: 4, rowGap: 0, minHeight: 24, padding: "1px 8px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-full)", background: "var(--surface-page)", color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", cursor: "pointer" }}
    >
      <span aria-hidden="true" style={{ fontSize: 14, letterSpacing: 1 }}>{faces.map((f) => f.anchor.emoji).join("")}</span>
      <span aria-hidden="true">{people}</span>
      <span className="cg-exact" aria-hidden="true" style={{ whiteSpace: "nowrap" }}>{exact}</span>
    </button>
  );
}

/* THE REACTIONS THREAD, WHOLE — drawn once because two boards draw it: the
   thread with its traces (`ChatThreadReactions`) and the opinions sheet a
   trace opens over it (`ChatMessageOpinions`). Mira's `Six it is` carries the
   five opinions the sheet lists, so the trace's faces and the sheet's rows are
   one fixture read two ways. */
const MIRA_QUESTION_OPINIONS = [
  { pDirected: 0.2, pInterest: 0.6 },
  { pDirected: 0.25, pInterest: 0.95 },
  { pDirected: 0.15, pInterest: 0.15 },
];
const OWN_CRUST_OPINIONS = [
  { pDirected: 0.55, pInterest: 0.2 },
  { pDirected: 0.6, pInterest: 0.25 },
];
const JUNO_BOOTS_OPINIONS = [{ pDirected: 0.95, pInterest: 0.9 }];
const MIRA_SIX_HOLDERS = [
  { name: "Sol Ferreira", handle: "sol", pDirected: 0.55, pInterest: 0.2 },
  { name: "Juno Baptiste", handle: "juno", pDirected: 0.9, pInterest: 0.25 },
  { name: "Ada Okonkwo", handle: "ada", pDirected: 0.5, pInterest: 0.25 },
  { name: "Tobias Lindqvist", handle: "tobias", pDirected: 0.6, pInterest: 0.65 },
  { name: "Kel Moreau", handle: "kel", pDirected: 0.15, pInterest: 0.2 },
];
const MIRA_SIX_OPINIONS = MIRA_SIX_HOLDERS.map(({ pDirected, pInterest }) => ({ pDirected, pInterest }));

function ReactionsThreadBody() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>21 September</DayDivider>
        <ChatBubble author={CHAT_KEL} when="19:02" sealed>
          <ChatSealedNotice />
        </ChatBubble>
        <DayDivider>22 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="21:10" trace={MIRA_QUESTION_OPINIONS}>
          Low tide's at six tomorrow — anyone walking the flats?
        </ChatBubble>
        <ChatBubble own when="21:31" trace={OWN_CRUST_OPINIONS}>
          Crust held all the way past the slipway today.
        </ChatBubble>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_JUNO} when="08:05" sealed id="boots" trace={JUNO_BOOTS_OPINIONS}>
          I'll bring the spare boots — tell me your size.
        </ChatBubble>
        <ChatBubble author={CHAT_MIRA} when="08:40" trace={MIRA_SIX_OPINIONS}>
          Six it is. Meet at the harbour office.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}

/* ── THE REMOVED MESSAGE ─────────────────────────────────────────────────────

   A MESSAGE REMOVED IS A MARK WHERE THE BUBBLE STOOD — on its own side, under
   its sender's name, at its own clock time. Removal takes the payload, never
   the record (erasure.md §1; design.md §9, *Removed*), so the message keeps
   its place in the transcript and every reply that quotes it keeps its quote's
   door; what went is the words and the media.

   THE MARK IS `RedactedContent`, whole, in the bubble's place — the reserved
   surface a kept space wears, one step above the page and above either bubble
   fill, so a removed message never reads as a quieter message. Its two
   readings are the two the standing honesty rule keeps apart (readme §9, *Two
   reasons, two wordings*):
   · `author` — the sender's own Remove (round A's docblocked act, drawn now):
     `Removed by its author`, with a message's own second line;
   · `illegal` — a platform verdict, by a passed proposal: `Removed under the
     platform's rules` — `A passed proposal removed it. The decision is
     public.`
   They must never read alike, and they do not: different words on the first
   line, different claims on the second, and nothing either one shares with a
   live bubble. A chat's own message disavowal (`decision:disavow_message`)
   removes nothing — the body stays (chats.md §6) — and stays deferred with
   the moderation slice. */
function RemovedBubble({ own = false, author, first = true, last = true, when, id, reason = "author", note }) {
  return (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
      {!own && (last ? <MonogramAvatar name={author.name} src={author.src} size="md" /> : <span style={{ flex: "none", width: 32 }} />)}
      <div data-message={id} style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 4 }}>
        {!own && first && (
          <span style={{ fontSize: "var(--text-label-medium)", lineHeight: "var(--text-label-medium--line-height)", fontWeight: "var(--text-label-medium--font-weight)", paddingLeft: 4 }}>
            {author.name}
          </span>
        )}
        <RedactedContent reason={reason} note={note} />
        <span style={{ alignSelf: "flex-end", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>{when}</span>
      </div>
    </div>
  );
}

const REMOVED_MESSAGE_NOTE = "Its place in the chat stays, and so do the replies to it.";

/* ── VOICE NOTES ─────────────────────────────────────────────────────────────

   AUDIO JOINS AS A CHAT-SCALE MEDIA KIND, AND ONLY THERE (jakob 2026-09-24).
   A post's audio stays parked; a message may carry a voice note, the
   messenger's own kind of media, the way it may carry a picture or a clip.

   THE BUBBLE: play, a scrub line, the length — WhatsApp's shape, drawn in
   CoGra's quiet ink. The play control is glyph-only in the bubble's own ink
   (a filled disc per voice note would make a thread of them a row of calls to
   action); the scrub line is a hairline track with the played part and a
   thumb in `primary`, the one colour the transport spends; the length is
   `label-small`, tabular, beside it. A playing note shows its elapsed time
   where the length stood — behaviour, stated.

   DESCRIBED FOR ACCESSIBILITY LIKE ALL MEDIA. A picture's alt text is
   authored and optional and never invented (`MediaAttachment`); a voice note
   is the same: its accessible name is the author's description where they
   gave one, and `Voice message, 0:42` where they did not. The description is
   written in the recording foot's `Describe` (the describe sheet, audio's
   shape), before the note is sent.

   E2E LIKE ANY ATTACHMENT (chats.md §7): with the lock on, the audio bytes are
   encrypted on the device under the epoch key before upload. A keyed reader
   hears it, the quiet lock by the time; a reader with no key meets
   `NoKeyMedia`'s voice tile. */
/* COMPACT, AND ON THE TRANSPORT'S OWN TIMELINE (jakob's canvas review, the fix
   pass: "the tall block goes"). One 40px band: the play glyph at the left, and
   beside it the video transport's `Timeline` master on its `surface` tone,
   with the length at the line's start under it and the bubble's clock at the
   same line's end — WhatsApp's voice bubble, and no separate clock line. The
   timeline is the one the viewer's transport draws, so a voice note and a clip
   seek with one control. */
function VoiceNote({ length, progress = 0, description, stamp }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, minHeight: 40 }}>
      <button
        type="button"
        aria-label={`Play — ${description ?? `Voice message, ${length}`}`}
        className="cg-state cg-focus cg-hit"
        style={{ display: "grid", placeItems: "center", width: 40, height: 40, flex: "none", border: 0, padding: 0, marginLeft: -8, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-body)", cursor: "pointer" }}
      >
        <Icon name="play_arrow" size={28} />
      </button>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", paddingTop: 4 }}>
          <Timeline tone="surface" progress={progress} elapsed="0:00" duration={length} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{length}</span>
          {stamp}
        </div>
      </div>
    </div>
  );
}

/* ── THE FACES AN ENCRYPTED ATTACHMENT WEARS ─────────────────────────────────

   AN ENCRYPTED MESSAGE ENCRYPTS ITS ATTACHMENTS, ON THE DEVICE, UNDER THE
   EPOCH KEY (chats.md §7, the encrypted-attachments clause). A KEYED reader
   sees the picture, the clip or the voice note as any member does, with the
   quiet lock by the time — `ChatBubble`'s `sealed`, unchanged. A NO-KEY reader
   gets `NoKeyMedia`: the reserved tile a kept space wears, the lock on it and
   one friendly sentence in the notice's register — what this is, and why it
   will not open. Never an error, never a warning glyph: nothing failed.

   NO EXPAND-TO-BYTES FOR MEDIA — THE ASYMMETRY WITH TEXT, ON PURPOSE. A no-key
   text message offers `Show the encrypted text`, because cipher text is at
   least characters: a reader can see that something was said and roughly how
   much, and the raw string is honest to show. Cipher PIXELS ARE NOTHING — an
   encrypted picture decoded as an image is noise, and its bytes as text are a
   wall of base64 that says less than the sentence does. So the tile is the
   whole face, and it has no second tap.

   THE TILE CLAIMS NO SHAPE. A picture's ratio rides its encrypted payload, so
   a no-key reader cannot know it, and a tile at the picture's true shape would
   be a claim the reader's device could not have made. It stands at the wide
   rung at the bubble's width; the voice tile at a band's height, where the
   voice note would stand. A captioned message's words are sealed with it and
   wear the text notice under the tile (`ChatSealedNotice`) — stated, not
   drawn.

   AND THE IMPLEMENTATION CONSEQUENCE, CARRIED FROM THE IMPLEMENTATION
   SESSION'S FLAG: CLIENT-SIDE PROCESSING IS THE ONLY QUALITY ENFORCEMENT FOR
   ENCRYPTED CHAT BLOBS. The server holds ciphertext and no key, so no
   transcode, re-encode, thumbnail or size-normalising path exists for them —
   whatever the device uploads is what every keyed member downloads. Resizing,
   compression, format normalisation and the stored first-frame still all run
   on the sender's device before encryption, or not at all; a plaintext
   thumbnail beside an encrypted body would make the lock a lie. */
const NO_KEY_MEDIA_WORDS = {
  picture: "An encrypted picture — you don't have the key to see it.",
  clip: "An encrypted clip — you don't have the key to play it.",
  voice: "An encrypted voice message — you don't have the key to hear it.",
};

/* THE TILE IS `MediaAttachment`'S OWN RESERVED REGION, MOUNTED (the
   componentization law, the fix pass): a `src`-less attachment is the system's
   one drawing of "a space kept for media that is not here", and its `label`
   slot carries the lock and the sentence — the sentence in `text-body`, the
   notice's ink ruling. The picture's reserve stands at the wide rung, the
   voice note's at a band (`4 / 1`), neither the payload's true shape. */
function NoKeyMedia({ kind = "picture" }) {
  const words = NO_KEY_MEDIA_WORDS[kind];
  return (
    <div role="img" aria-label={words} style={{ margin: "4px 0 2px" }}>
      <MediaAttachment
        ratio={kind === "voice" ? "4 / 1" : "wide"}
        radius="var(--radius-medium)"
        label={
          <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", color: "var(--text-body)", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)" }}>
            <Icon name="lock" size={18} />
            <span>{words}</span>
          </span>
        }
      />
    </div>
  );
}

/* ── THE RECORDING FOOT ──────────────────────────────────────────────────────

   TAP TO RECORD, ONE STATE (jakob's ruling, the final micro-fix). A tap on the
   mic starts the recording and the foot becomes its controls, all of them
   visible buttons: no hold, no slide to cancel, no slide to lock, and no
   release that signs. Hidden gestures fight the product's visible-controls
   honesty, and a release that sends would sign by accident — the sign-step
   ruling says a signature is always a deliberate press. So the foot is
   WhatsApp's locked recording, and nothing before it.

   TWO LINES. On top, the live mark — a small mic in `primary`, calm rather
   than a red dot — and the running length, with `Describe` at the line's end:
   the author's description, the one place a voice note is described
   (`VoiceNote`). Under it: DELETE on the left (`delete`, the recording let go,
   nothing signed), the E2E LOCK beside it, PAUSE in the middle, and the
   explicit SEND ARROW on the right, the seal's own `SendSeal` — pressing it
   signs and sends the note.

   PAUSE ↔ PLAY (jakob, explicit). Paused, the middle control becomes PLAY —
   `Keep recording` — and pressing it goes on recording INTO THE SAME NOTE: the
   audio extends, the length counts on from where it stopped. The live mark
   rests (the mic in `text-secondary`) and the length reads as held
   (`paused`, drawn as `ChatThreadRecordingPaused`). Delete, the lock and the
   arrow stand unchanged, so a paused note can be sent as it is.

   THE E2E LOCK IS VISIBLE AND FLIPPABLE (jakob's ruling: the foot's sticky
   lock governs a voice message like any message — set before, flippable until
   send). The same `LockToggle`, in the same ink, as the typed foot's, holding
   the chat's sticky choice; the quiet line under the acts says what the arrow
   will seal. */
function DeleteRecording() {
  return (
    <button
      type="button"
      aria-label="Delete the recording"
      className="cg-state cg-focus cg-hit"
      style={{ display: "grid", placeItems: "center", width: 40, height: 40, flex: "none", border: 0, padding: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer" }}
    >
      <Icon name="delete" size={22} />
    </button>
  );
}

function PauseOrPlay({ paused = false }) {
  return (
    <button
      type="button"
      aria-label={paused ? "Keep recording" : "Pause the recording"}
      className="cg-state cg-focus cg-hit"
      style={{ display: "grid", placeItems: "center", width: 48, height: 48, flex: "none", border: "1px solid var(--border-field)", padding: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--primary)", cursor: "pointer" }}
    >
      <Icon name={paused ? "play_arrow" : "pause"} size={24} />
    </button>
  );
}

function ChatFootRecording({ length, sealed = false, paused = false }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 16px", borderTop: "1px solid var(--border-hairline)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 32 }}>
        <span role="timer" aria-label={paused ? `Recording paused at ${length}` : `Recording, ${length}`} style={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-body)", fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)", fontVariantNumeric: "tabular-nums" }}>
          <span aria-hidden="true" style={{ display: "inline-flex", color: paused ? "var(--text-secondary)" : "var(--primary)" }}>
            <Icon name="mic" size={20} />
          </span>
          {length}
          {paused && <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>· Paused</span>}
        </span>
        <InlineAction size="sm">Describe</InlineAction>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <DeleteRecording />
          <LockToggle on={sealed} />
        </span>
        <PauseOrPlay paused={paused} />
        <SendSeal />
      </div>
      <QuietNote>{sealed ? "Encrypted — only the chat's members can hear it." : "Not encrypted — anyone can hear it. The lock beside delete encrypts it."}</QuietNote>
    </div>
  );
}

/* ── THE PENDING AND THE UNLANDED MESSAGE ────────────────────────────────────

   THE PRODUCT'S PENDING GRAMMAR AT CHAT SCALE (design.md §9, *Pending*). A
   sent message is signed at once and ordered a moment later; until then it is
   PENDING, and it shows in full — the words are real, only its place in the
   order is not — with `Still settling` before its clock, in the time's own ink
   (`ChatBubble`'s `pending`). design.md says pending content shows in full to
   EVERY reader, not only its author; the board draws the author's thread,
   where the case is met most, and the same bubble reads the same to anyone.

   A MESSAGE THAT EXPIRES UNLANDED LEAVES EVERY READER'S VIEW — readers see
   nothing in its place, since on the graph nothing ever existed — AND ITS
   AUTHOR GETS A CALM NOTICE THAT IT DID NOT LAND (design.md §9), in the
   honesty register, never `error`. `DidntLand` is that notice at chat scale:
   `ComposeExpired`'s task card cut down to the thread — on the author's own
   side where the bubble stood, an outline on the page ground rather than a
   bubble fill, because it is no longer a message and nobody else sees it; the
   words it carried quoted so the author knows which one; `Nothing was spent.`,
   the post's own reassurance; and two answers, the post card's pair: `Dismiss`
   quiet, `Try again` filled (jakob 2026-09-24, the word people are used to) — the
   words return to the field, and the arrow signs as always, so nothing is
   re-signed on this tap: the next send is the trying. */
function DidntLand({ words }) {
  return (
    <div role="status" style={{ alignSelf: "flex-end", maxWidth: "78%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px 8px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-large)" }}>
      <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>Your message didn't land</span>
      <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>“{words}” couldn't finish settling. Nothing was spent.</span>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <Button variant="text" size="sm">
          Dismiss
        </Button>
        <Button size="sm">Try again</Button>
      </div>
    </div>
  );
}

/* ── A POST SENT INTO A CHAT ─────────────────────────────────────────────────

   A SENT POST IS A MESSAGE CITING THE POST (backlog item 23, ruled in; the
   Reference grammar). One Send mints the message and a Reference from it to
   the post (chats.md §3), so the bubble carries the post the way a citation
   is read back — as itself: its mark and its name, and under the name whose
   it is (the cited round's single reading, `ReferenceRow`'s anatomy at chat
   scale). The reader's own words, where they added any, are the message's
   body under it.

   AT CHAT SCALE, NOT FEED SCALE. The post is not re-drawn as a card inside a
   bubble — a thread of those would read as a feed — but as its reference: the
   32px `NodeMark` (the post's first picture, or its `T`), its title, and its
   author. A DOOR: the whole block opens the post.

   THE PAIR IS NOT DRAWN — the lane's call, flagged. A reference row reads its
   pair back; here a face beside a sent post would read as the sender's
   REACTION to it, which is the trace's job, and the bubble carries content,
   time and the lock. The citation's pair is the Send's default low one, read
   where every reference's pair is read — the message's tags and references.

   A REFERENCE IS NEVER ENCRYPTED (chats.md §7: references are edges on the
   shared graph and have no payload to hide). So a post sent with the lock on
   seals the words beside it and not which post it was — the send sheet says
   so while the lock is on, and a no-key reader sees the post's block over the
   text notice.

   IT IS `ReferenceRow`, MOUNTED (the componentization law, the fix pass) — the
   reading side's own row for a cited node, its mark, name and second line,
   set on the tonal step above the bubble fill so it reads as a thing carried
   rather than as the bubble's words. The row's own button is the door. */
function BubbleCitation({ kind = "post", name, src, sub }) {
  return (
    <div style={{ margin: "2px -12px 4px", borderRadius: "var(--radius-medium)", background: "var(--surface-container-highest)", overflow: "hidden" }}>
      <ReferenceRow kind={kind} name={name} src={src} sub={sub} onOpen={() => {}} />
    </div>
  );
}

/* ── THE FEED CARDS ──────────────────────────────────────────────────────────

   A CHAT AND A MESSAGE ARE BOTH DECLARED FEED KINDS, OPT-IN (the feed's filter
   lists `Chats` and `Messages`, off by default). REBUILT ON THE REAL CARD
   (jakob's canvas review, the fix pass): both are `PostCard`, MOUNTED — the
   feed's one card, with its own header, its ⋮, its body and its NORMAL action
   row: the opinion face, the score, the comments, the share. No invented acts:
   THE CARD ITSELF IS THE DOOR, the way a post card opens its detail — a chat's
   card opens its thread (read from outside, the join at the foot, or the
   reader's own), a message's card opens its thread scrolled to the message.
   The join lives inside, never on the card.

   REDRAWN FOR JAKOB TO JUDGE (the final micro-fix; he blessed the direction
   conditionally — "lets see... i am interested to find out how it will
   look"). The shell stays `PostCard`'s own; what changes is what stands in
   its author line and its body, through the card's two additive slots
   (`lead`, `main`), so neither card reads as a text post:

   THE MESSAGE CARD: the author line is the sender — the real `ActorChip` —
   and their chat, `· in Coast walkers`, with the age and the ⋮ at the right
   as on every card. The BODY IS THE MESSAGE AS A REAL CHAT BUBBLE: the
   thread's own `ChatBubble` master, its fill, its tail and its tucked clock,
   the face beside it dropped (`avatar={false}`) because the author line
   already names the sender, and its fill lifted one tonal step (`onCard`) so
   it shows against the card. Nothing but a chat looks like a bubble, so the
   card says what it is before a word is read. ONLY PLAINTEXT MESSAGES ARE
   CANDIDATES — the lane's reading, flagged: a feed reader mostly holds no
   key, and a card whose body is a no-key notice is a card about nothing.

   THE CHAT CARD: the author line is the chat — its disc (`ChatDisc`), its name
   with the `forum` glyph beside it (the chat's kind mark, `NODE_GLYPHS`'), and
   the policy line under them as the calm subline; age and ⋮ at the right. The
   BODY IS A PREVIEW ROW, not prose: the last message the way the chats list
   previews it — the real `ContentRow` at its chronicle variant, the sender's
   face and name over their words — so the card reads as a place where talk
   is happening. The description lives on the chat's details. No presence,
   ever: nothing on the card says who is online.

   THE ⋮ IS THE CARD'S OWN, AND IT NEEDS A MENU TO APPEAR: `PostCard` closes
   whatever `menuItems` it is handed with the license row, and draws no dot at
   all when it is handed neither (`OverflowMenu` returns nothing for an empty
   list). So both cards carry the card menu — Save, Cite in a new post — and a
   license, as every canonical card fixture does. */
/* ── THE SEAL'S OPINION IS THE REAL STANCE ELEMENT ───────────────────────────

   jakob's ruling (the fix pass, 2026-09-24): "you should be able to express
   your actual opinion when accepting an invite or creating a request." A join,
   a request and a founding each carry a real stance toward the chat (chats.md
   §4, the Participant's parameters; invitations.md §3, defaulted `(+0.1,
   +0.1)`), and the reader must be able to SET it where they sign. So the
   seal's `Your opinion` row holds `StanceControl` itself — the face that looks
   tappable, its geek pair beside it, a tap opening the ordinary pad over the
   sheet (`ChatJoinSealPad`) and a hold signing nothing on its own, because the
   seal's button is what signs. A static readout that did not look pressable
   was the defect jakob caught.

   THE STAGED DEFAULT IS HANDED AS THE CONTROL'S VALUE, so the face and the
   pair read what will be signed if the reader changes nothing — one record,
   the low default. The pad's `Set` replaces it before anything is signed.
   And the control runs in its FIRST-CONNECTION mode (jakob, the final
   micro-fix): a first connection has nothing to walk back, so the pad omits
   the walk-away.

   THE READER'S OWN MESSAGE IS THE OTHER CASE: an opinion on one's own content
   names a valence only (the one-axis table), so `ChatSignSheet` keeps the
   compose seal's own grammar — `OwnStanceReadout` with `Adjust` — canonical's
   `ComposeSeal` row exactly. */
const STAGED_STANCE = {
  current: { pDirected: 0.1, pInterest: 0.1 },
  rawSum: { pDirected: 0.1, pInterest: 0.1 },
  records: 1,
  severed: false,
  severance: { records: 0 },
};

function SealStance({ target, open = false }) {
  return <StanceControl targetLabel={target} bundle={STAGED_STANCE} defaultOpen={open} defaultPick={STAGED_STANCE.current} firstConnection onCommit={() => {}} />;
}

/* THE JOIN'S SEAL, WHOLE — drawn once because two boards draw it: the seal
   itself (`ChatJoinSeal`) and the pad parked over it (`ChatJoinSealPad`). With
   `padOpen` the control blooms its own parked pad, and a wash inside the sheet
   dims the seal beneath it — the pad grammar's arrangement (`PadHistoryDoor`),
   one layer up. */
function ChatJoinSealSheet({ padOpen = false }) {
  return (
    <>
      <ChatThreadInvitedBody />
      <BottomSheet open ariaLabel="What you sign" maxHeight="88%">
        <SheetTitle trailing={<HelpDot ariaLabel="How signing works" />}>What you sign</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 24px" }}>
          <ActsCard rows={[{ label: "Joining", value: "Night fishing crew", count: "1", countNoun: "join" }]} total="1 thing, signed" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <FactRow label="Invited by" value="Mira Voss" />
            <FactRow label="Your opinion" value={<SealStance target="Night fishing crew" open={padOpen} />} last />
          </div>
          <QuietNote>Joining is public — your name joins the member list. Encrypted messages sent before you join stay closed to you.</QuietNote>
          <Button style={{ width: "100%" }}>Sign and join</Button>
        </div>
        {padOpen && <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 15, background: "var(--scrim-dialog)" }} />}
      </BottomSheet>
    </>
  );
}

const CHAT_CARD_MENU = [
  { label: "Save", onSelect: () => {} },
  { label: "Cite in a new post", onSelect: () => {} },
];
const PUBLIC_DOMAIN = { attribution: 0, provenance: 0 };

const FEED_LEAD_SMALL = { fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" };

function ChatFeedCard({ name, image, policy, lastAge, last, score, comments }) {
  return (
    <PostCard
      lead={
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ChatDisc image={image} size={32} />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              {name}
              <span role="img" aria-label="a chat" style={{ display: "inline-flex", color: "var(--text-secondary)" }}>
                <Icon name="forum" size={16} />
              </span>
            </span>
            <span style={FEED_LEAD_SMALL}>{CHAT_POLICY_LINE[policy]}</span>
          </span>
        </span>
      }
      main={<ContentRow variant="chronicle" chevron={false} inert title={last.sender} name={last.sender} image={last.src} second={last.words} />}
      timestamp={lastAge}
      targetLabel={name}
      score={score}
      comments={comments}
      license={PUBLIC_DOMAIN}
      menuItems={CHAT_CARD_MENU}
      onOpen={() => {}}
    />
  );
}

function MessageFeedCard({ chat, author, bubbleAuthor, when, age, score, comments, children }) {
  return (
    <PostCard
      lead={
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <ActorChip handle={author.handle} displayName={author.displayName} />
          <span style={{ ...FEED_LEAD_SMALL, flex: "none" }}>{`· in ${chat}`}</span>
        </span>
      }
      main={
        <ChatBubble author={bubbleAuthor} first={false} when={when} avatar={false} onCard>
          {children}
        </ChatBubble>
      }
      timestamp={age}
      targetLabel={`${author.displayName}'s message`}
      score={score}
      comments={comments}
      license={PUBLIC_DOMAIN}
      menuItems={CHAT_CARD_MENU}
      onOpen={() => {}}
    />
  );
}
