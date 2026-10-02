/* Prepended to every screen by render-screens.mjs. Screen-level helpers only —
   anything reusable across PRODUCTS belongs in components/, not here. */

const {
  PostCard,
  CommentCard,
  OverflowMenu,
  ReferenceRow,
  CograBand,
  BandIcon,
  BackToTop,
  BottomNav,
  ALL_SLOTS,
  PageHeader,
  BorrowedViewBand,
  DeletionBand,
  MonogramAvatar,
  ActorChip,
  HIDE_ACTOR_LABEL,
  REDACTED_ACTOR_NAME,
  ProfileHeader,
  EmptyState,
  LoadingState,
  ComingSoonCard,
  Snackbar,
  StanceControl,
  TopicChip,
  Card,
  Button,
  InlineAction,
  Icon,
  MediaGallery,
  MediaAttachment,
  PendingMarker,
  EditedMarker,
  JoinPrompt,
  DialogSurface,
  BottomSheet,
  SheetItem,
  SheetTitle,
  TextField,
  FieldLabel,
  FieldSupport,
  PasswordField,
  RecoveryCode,
  SearchBar,
  Chip,
  SegmentedFilter,
  Checkbox,
  FeedFilter,
  FeedFilterSheet,
  FilterTrigger,
  FilterFoot,
  FilterSection,
  OrderSection,
  FEED_KINDS,
  FEED_FILTER_DEFAULT,
  HelpDot: SystemHelpDot,
  MediaThumb,
  PickTray,
  PickPrompt,
  PickedRow,
  DescribeCounter,
  PickedSheet,
  CitedSheet,
  TagsSheet,
  DescribeSheet,
  UploadStatusLine,
  UploadErrorLine,
  ActsCard,
  WizardHeader,
  PayoutAddress,
  StancePad,
  SeveranceConfirm,
  StanceReadout,
  OwnStanceReadout,
  StanceValue,
  StanceSlider,
  StanceStanding,
  StanceLandingLine,
  TAG_RANGES,
  TaggedRow,
  TransportError,
  NoticePanel,
  NoticeLine,
  SensitiveVeil,
  SensitiveScope,
  RedactedContent,
  MediaDisc,
  VideoTransport,
  SeekLine,
  ShareButton,
  GlyphAction,
  ExplainableNumber,
  MediaViewer,
  ReelRail,
  ReelCaption,
  PinnedClip,
  LICENSE_MENU_LABEL,
  LicenseTerms,
  ATTRIBUTION_TIERS,
  PROVENANCE_TIERS,
  LicenseSummary,
  NodeMark,
  TopicRemovable,
  StagedReference,
  RefusedFile,
  ActsFooter,
  SealFooter,
  WizardFooter,
  FactRow,
  QuotedRow,
  CoverRow,
  Caret,
  SectionLabel,
  SettingsGroup,
  SettingsRow,
  Switch,
  QuietNote,
  StanceRow,
  TabBar,
  ContentRow,
  CropViewport,
} = components;

/* Visually hidden, still read aloud — `StanceReadout`'s own constant, spelled
   here because a board reaches the bundle's components and not its helpers. */
const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/* THE NUMBERS IN A SENTENCE (readme §13, the geek round). A help or coaching
   line that speaks a pair leads with the face and carries the digits in a
   trailing `cg-exact` span, so the sentence follows the reading mode the way
   every readout does. The painted tail is `aria-hidden` and `spoken` says the
   same fact to a screen reader in both modes — the mode draws, it never
   redacts. */
function ExactTail({ exact, spoken }) {
  return (
    <>
      <span className="cg-exact" aria-hidden="true">{exact}</span>
      <span style={SR_ONLY}>{spoken}</span>
    </>
  );
}

/* THE PICKERS' QUIET ANNOUNCEMENT (jakob 2026-10-01). A pick moves its row out
   of the list into the staged section above it, and a staged row's × moves it
   back — a change an eye sees and an ear does not. So `TagPicker` and
   `ReferencePicker` carry one status message, the WCAG 4.1.3 pattern in
   `Snackbar`'s own wiring: `role="status"`, `aria-live="polite"`, mounted
   whether or not it has anything to say, because assistive technology only
   announces changes to a region it was already watching. It is the
   confirmation's register, never the field error's `role="alert"`: polite, so
   it waits behind what is already being read rather than cutting it off.

   SPOKEN ONLY, IT DRAWS NOTHING. Not a `Snackbar`: the row's move is already
   the visible confirmation, and a toast over a picker the reader is still
   working would cover the list they are picking from. A pick says `Added — in
   the staged list.`; the × says `Removed from the staged list.` */
function PickAnnouncement({ said = "" }) {
  return (
    <div role="status" aria-live="polite" style={SR_ONLY}>
      {said}
    </div>
  );
}

/* An opinion of one gentle record — the vouch-back default made a bundle. */
function mkBundle(pDirected, pInterest) {
  const pair = { pDirected, pInterest };
  return { current: pair, rawSum: pair, records: 1 };
}

/* The people of the canonical canvas (readme: mock people and photos). */
const ADA = { handle: "ada", displayName: "Ada Okonkwo" };
const TOBIAS = { handle: "tobias", displayName: "Tobias Lindqvist" };
const SOL = { handle: "sol", displayName: "Sol Ferreira" };
const MIRA = { handle: "mira", displayName: "Mira Voss" };

/* @tobias's comment at the thread's top — spelled once, because the thread
   draws it and the reply composer aimed at it quotes it. */
const TOBIAS_COMMENT = "That stretch after the second bend is the reason I keep a camera in the glovebox.";

/* Genesis content always declares a license, so every card has at least that
   menu entry — without one the dot vanishes, and it must not. Citing rides the
   same menu on every content (readme §13), and so does saving (the private-
   viewer-state round): both act on the thing itself, whoever wrote it.

   THE HIDE ROW IS NOT HERE, and that is the difference between a card's menu
   and a menu board: hiding names the author, so it is spelled where the author
   is known rather than handed to every card as one string. */
const CITE_ROW = { label: "Cite in a new post", onSelect: () => {} };
const SAVE_ROW = { label: "Save", onSelect: () => {} };
const CARD_MENU = [SAVE_ROW, CITE_ROW];

/* A POST'S BODY IS WORDS XOR MEDIA (post.md). Every fixture with a picture
   carries its words as the DESCRIPTION — the caption beside the body — and no
   `content`; only the text posts below have one. */
const ADA_POST = {
  author: ADA,
  title: "The long way home",
  description: "Took the coast road instead of the tunnel. Four hours longer, worth every minute.",
  timestamp: "2h",
  media: [{ src: "post-photo.jpg", ratio: "wide", fit: "cover" }],
  topics: ["photography", "coastroad"],
  references: 1,
  score: "15.20",
  comments: 3,
  opinions: 9,
  license: { attribution: 1, provenance: 0 },
  menuItems: CARD_MENU,
};

const TOBIAS_POST = {
  author: TOBIAS,
  content: "Low tide at six tomorrow — anyone walking the flats?",
  timestamp: "1h",
  score: "3.10",
  comments: 1,
  opinions: 2,
  license: { attribution: 0, provenance: 0 },
  menuItems: CARD_MENU,
};

const SOL_POST = {
  author: SOL,
  title: "Salt maps of the coast road",
  description:
    "Rubbings from three weekends at low tide — paper against the salt crust, the side of a wax stick, and whatever the wind allowed.",
  timestamp: "3d",
  media: [
    { src: "post-photo.jpg", ratio: "square", fit: "cover" },
    { src: "inviter.jpg", ratio: "square", fit: "cover" },
  ],
  topics: ["fieldnotes", "saltmaps"],
  score: "9.10",
  comments: 2,
  opinions: 4,
  license: { attribution: 0.5, provenance: 0.5 },
  menuItems: CARD_MENU,
};

/* The gallery post (media slice, 2026-08-31): four pictures at one crop shape,
   one frame swiped, dots only. Shared the moment its detail view needed it too. */
const MIRA_GALLERY_POST = {
  author: MIRA,
  title: "Sunday at the tide market",
  description:
    "Everything the flats give up in one morning — the stand by the sea wall had honey from the headland hives again.",
  timestamp: "4h",
  media: [
    { src: "gallery-market.jpg", ratio: "tall", fit: "cover", alt: "Crates of strawberries on a market stand." },
    { src: "gallery-veg.jpg", ratio: "tall", fit: "cover", alt: "Vegetables laid out on a cutting board." },
    { src: "gallery-honey.jpg", ratio: "tall", fit: "cover", alt: "A jar of honey in low sun." },
    { src: "gallery-grapes.jpg", ratio: "tall", fit: "cover", alt: "Two hands holding a bunch of grapes." },
  ],
  topics: ["tidemarket", "coastroad"],
  score: "6.40",
  comments: 2,
  opinions: 8,
  license: { attribution: 0, provenance: 0 },
  menuItems: CARD_MENU,
};

/* CograBand moved into the system (components/navigation/CograBand.jsx) the
   moment a second canvas needed it — destructured above like every master. */

/* The dev-phase APK line riding the collapsing top (readme §13, entry). The
   web draws it and the app does not: the line offers a browser visitor the app
   they are not in. */
function ApkLine() {
  return (
    <div style={{ padding: "0 16px 12px 16px" }}>
      <span
        style={{
          fontSize: "var(--text-label-medium)",
          lineHeight: "var(--text-label-medium--line-height)",
          fontWeight: "var(--text-label-medium--font-weight)",
          letterSpacing: "var(--text-label-medium--letter-spacing)",
          color: "var(--primary)",
        }}
      >
        On Android? Download the app (APK)
      </span>
    </div>
  );
}

/* The feed column: full-width rounded cards, 8px of surface as the seam. */
function FeedList({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 0 0" }}>
      {children}
    </div>
  );
}

/* An application step riding the feed as a card (readme §13, entry).

   IT IS THE PRODUCT SPEAKING, AND IT HAS TO LOOK LIKE IT (jakob 2026-09-15, on
   `ApplicantRejected` and "maybe other of these aswell": "maybe some cogra
   branding (color shade or sth at the corners?)"). Every other card in a feed
   column is somebody's post — a person, with a handle and a face. These carry
   no author because their author is CoGra, and in the feed card's own dress
   they read as a text post from nobody, which is how a reader scrolls past the
   one card in the column that is addressed to them.

   THE BRAND RIDES THE EDGE, NOT THE GROUND (jakob 2026-09-15: "wash of the box
   is not what i meant.. this just looks bad.. i was thinking about some
   gradient"). A tinted ground reads as a stain on a card rather than a mark on
   one, and it is the half of the card a reader is trying to read through. So
   the ground goes back to the feed card's own colour and the card takes a
   `--ring-task` edge instead: the brand's own sweep, at the brand wash's angle,
   drawn as a hairline no post card in the column can wear. It is the story
   ring's grammar — a ring around something ordinary is the one decoration every
   reader already reads as "the system put this here".

   THE RING NEEDS THE MARK BESIDE IT, so the mark stays. The ring says a card is
   marked; only the mark says by WHOM, and a ring alone is exactly the signal a
   reader could mistake for a post somebody had emphasised. It is `aria-hidden`
   and carries no words — the title already says what the card is; the mark and
   the ring are both for the eye mid-scroll.

   THE TITLE KEEPS ITS ROW. The mark shares the heading's line rather than
   taking one of its own, so a task card is the height it always was and the
   column's rhythm does not change around it. `border-box` keeps the ring inside
   the card's own width wherever the card is not a stretched feed child.

   A CARD THAT NEEDS THE READER'S ACTION WEARS THE OLIVE (jakob 2026-10-02,
   the olive split). `tone="notice"` puts the card on the account-notice
   register — `tertiary-container` with its `on-` pair, the ground
   `NoticePanel` wears — so a step the reader still owes (verify the email,
   restore the key, the security notice) cannot be scrolled past as one more
   post. Its filled action is `Button`'s `inverse`, the register's own. A card
   that only says how things stand (waiting, approved and landing) keeps the
   feed card's ground, so the olive keeps its force. The ring and the mark
   ride both: they say who speaks, the ground says whether it asks.

   ON THE OLIVE, EVERY INK IS THE REGISTER'S. `primary` on `tertiary-container`
   measures 2.8:1 in the light theme and about 1:1 in the dark — under §10's
   AA floor for a label and under 3:1 for the mark — and the page's own inks
   fare no better (`on-surface-variant` 4.0:1 light, `on-surface` 1.8:1
   dark). So the card scopes `--primary`, `--outline`, `--on-surface`,
   `--on-surface-variant` and `--text-secondary` to `on-tertiary-container`
   (4.6:1): the mark, an outlined or text button, an inline action and a
   master drawn inside the card (the ask link's block) all read in the
   panel's own pair — the reason `inverse` exists, carried to the rest. */
function TaskCard({ title, body, tone, children }) {
  const notice = tone === "notice";
  const ground = notice ? "var(--tertiary-container)" : "var(--surface-card)";
  return (
    <Card
      style={{
        flex: "none",
        boxSizing: "border-box",
        border: "var(--ring-task-width) solid transparent",
        background: `linear-gradient(${ground}, ${ground}) padding-box, var(--ring-task) border-box`,
        ...(notice
          ? {
              color: "var(--on-tertiary-container)",
              "--primary": "var(--on-tertiary-container)",
              "--outline": "var(--on-tertiary-container)",
              "--on-surface": "var(--on-tertiary-container)",
              "--on-surface-variant": "var(--on-tertiary-container)",
              "--text-secondary": "var(--on-tertiary-container)",
            }
          : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-title-medium)",
            lineHeight: "var(--text-title-medium--line-height)",
            fontWeight: "var(--text-title-medium--font-weight)",
          }}
        >
          {title}
        </h2>
        <Icon name="mark" size={20} pickColor="var(--primary-container)" style={{ flex: "none", color: "var(--primary)" }} />
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>{body}</p>
      {children}
    </Card>
  );
}

/* The key ceremony, as the two dialogs find it (readme §13, entry). KeyConfirm
   and KeyDecline are the SAME screen under a different ask, so the screen is
   written once and the boards differ only in the dialog stacked on it — the
   ThreadDetail rule: a body on a second board stops being board-local. The
   ceremony's own second paragraph and its two buttons belong to KeyCeremony,
   where they are still reachable; under a modal they are not, and drawing
   controls the dialog has taken away would be drawing a lie. */
function KeyPledge() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Your key
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-large)",
            lineHeight: "var(--text-body-large--line-height)",
            letterSpacing: "var(--text-body-large--letter-spacing)",
          }}
        >
          Everything you publish is signed with a key that is created on this browser and stays in your hands — CoGra never
          holds it and can never reissue it.
        </p>
      </div>
    </>
  );
}

/* The detail surface's header: back plus the ONE overflow. On a detail view the
   menu lives up here and the card's own dot yields (PostCard hides it in
   detail) — two dots would be two menus for one post.

   THE ARROW IS HISTORY AND ITS LABEL NAMES THE ORIGIN (the layer law, readme
   §4, *Navigation*): `Back to Saved`, `Back to the search`, `Back to #saltmaps`
   — the post detail's noun table, readme §13, the navigation-and-sheets round.
   `Back to feed` is what the boards draw, because it is the cold entry's label
   as well as the feed's: the state that stands with no route behind it. */
function DetailHeader({ items, node }) {
  return (
    <PageHeader
      backHref="#"
      backLabel="Back to feed"
      action={<OverflowMenu items={items} ariaLabel="More on this post" node={node && "menu"} />}
      node={node}
    />
  );
}

/* What the one menu holds — the author's post vs someone else's.

   ONE MECHANISM, SPELLED TWICE. A card mounts its own menu and closes whatever
   `menuItems` it was handed with the license row; a DETAIL surface hides the
   card's dot and the header carries the menu instead, so these lists are that
   same menu written out for the header, and they take the row's words from the
   master's atom rather than spelling them again. Both keep the card's own
   order: the acts the menu was opened for lead, and the license row closes it,
   the license being the rarest read in the product.

   SAVE IS THE ROW THAT CARRIES ITS OWN STATE (readme §13, the private-viewer-
   state round). Nothing outside this menu says a thing is saved — the action
   row stays opinion · score · comments · share — so the row reads `Save` while
   it is not and `Unsave` while it is: one word (jakob 2026-09-11). A control
   says what will happen (§3), which is why the saved form is a verb and not
   the word Saved.

   SAVE IS ON YOUR OWN POSTS TOO (jakob 2026-09-11), and it LEADS. Saving is
   private, so whose post it is has nothing to do with whether a reader may
   keep it — and the Saved list is a shelf, which is exactly what a person
   reaches for on their own work. It takes the first row on every menu that
   has it, post, comment and profile alike: the thumb learns one position, and
   the one menu that also holds Remove is the last place to move the rows
   around. The license closes this menu as it closes the others. */
const LICENSE_ROW = { label: LICENSE_MENU_LABEL, onSelect: () => {} };
/* CITING RIDES THIS MENU TOO (backlog item 100, ruled the batch-rulings
   round). `CARD_MENU`'s own note says citing acts on the thing itself,
   whoever wrote it — the argument Save was already given — and self-citation
   is a real thing an author does: a post that builds on their own earlier one
   points at it exactly the way it would point at anyone else's. It takes the
   reader menu's own position, second, so the thumb finds one row in one place
   on every menu that has it. */
/* THE AUTHOR'S REMOVAL, one row on every own menu that has it — the post's and
   the comment's (the comment-removal round). It stands as the LAST of the acts,
   where the post's menu has always put it: the rarest act, and the one that
   takes the content away. */
const REMOVE_ROW = { label: "Remove", onSelect: () => {} };
const OWN_POST_MENU = [
  SAVE_ROW,
  CITE_ROW,
  { label: "Edit", onSelect: () => {} },
  { label: "Mark as sensitive", onSelect: () => {} },
  REMOVE_ROW,
  LICENSE_ROW,
];
const READER_POST_MENU = [...CARD_MENU, { label: HIDE_ACTOR_LABEL("@ada"), onSelect: () => {} }, LICENSE_ROW];
/* THE COMMENT'S MENU IS WHERE ITS OPINIONS LIVE (backlog item 55; jakob ruled
   both doors, and this is the comment's). A post's door is a count row on its
   detail surface; a comment has no detail surface of its own — it lives inside a
   sheet — so its door is the ⋮ that every other act on it already uses.

   IT STANDS WHATEVER THE COUNT IS, which is the difference between a menu row
   and a count line: the line drops away at zero because a tap that can only open
   an empty list is a tap spent on nothing, while a menu row that came and went
   with a number would make the menu a different menu every time. That is also
   why the empty sheet is reachable only from here.

   IT SITS AFTER THE ACTS AND BEFORE THE LICENSE. A menu leads with the acts it
   was opened for and closes on the license (`CARD_MENU`'s order); reading who
   holds an opinion is not an act, so it falls between them. */
const OPINIONS_ROW = { label: "Opinions on this", onSelect: () => {} };
/* ── WHAT CITES THIS (the topic round, 2026-09-14) ─────────────────────────
   The inbound mirror of the opinions round (backlog item 55), and the same two
   doors: a count line on the post's detail, and the comment's ⋮ — because a
   comment has no detail surface of its own, and its ⋮ is where every other act
   on it already lives.

   THE ROW STANDS AT ANY COUNT, the menus round's rule: a count LINE drops away
   at zero because a tap that can only open an empty list is a tap spent on
   nothing, while a menu row that came and went with a number would make the
   menu a different menu every time. So the empty sheet is reachable only here.

   IT SITS BESIDE THE OPINIONS ROW, between the acts and the license, for that
   row's reason: reading who has pointed at this is not an act. Inbound before
   opinions, because it is a fact about the artifact and the other is a fact
   about people. */
const CITED_BY_ROW = { label: "Cited by", onSelect: () => {} };

const COMMENT_MENU = [...CARD_MENU, CITED_BY_ROW, OPINIONS_ROW, LICENSE_ROW];
/* YOUR OWN COMMENT'S MENU (the comment-removal round, 2026-10-01): the reader's
   menu with `Remove` joined as the last of the acts — after Save and Cite,
   before the two readings, the license closing it. That is `OWN_POST_MENU`'s
   place for the row, and the one `ChatMessageMenuOwn` already took at message
   scale.

   NO EDIT ROW AND NO SENSITIVE ROW, though the post's own menu has both. A
   comment's Edit is a button on its own card (`CommentCard`'s `own`), so a
   menu row would be a second door to one act; and a comment's sensitive mark
   rides its edit, which is where the post's row sends the reader too. */
const OWN_COMMENT_MENU = [...CARD_MENU, REMOVE_ROW, CITED_BY_ROW, OPINIONS_ROW, LICENSE_ROW];

/* THE THINK-TWICE DIALOG BEHIND AN AUTHOR'S `Remove`, ONE ANATOMY PER KIND
   (`RemoveConfirm`'s, shared the moment the comment's confirm drew it a second
   time). The nouns swap per kind and nothing else moves (jakob 2026-09-23,
   copy-voice): what goes, the mark that stays in its place, that it is
   immediate and permanent — and the safe answer is the filled one, `Remove`
   carrying no colour, because a removal is not an error (jakob 2026-09-15). */
const REMOVE_CONFIRM_COPY = {
  post: {
    title: "Remove this post?",
    body: `The words and pictures leave every reader's view, along with every earlier version's. A visible mark stays in their place — "Removed by its author" — and the post's spot in threads stays with it.`,
  },
  comment: {
    title: "Remove this comment?",
    body: `The words and pictures leave every reader's view, along with every earlier version's. A visible mark stays in their place — "Removed by its author" — and the comment's spot in its thread stays with it.`,
  },
};

/* `overSheet` lifts the dialog above a sheet it is raised over — the comments
   thread — by `ReplyKeyAbsent`'s one layer of board glue: `DialogSurface` sits
   on the base wash layer and the sheet one above it, so the dialog is the
   thing raised last. Over the post detail there is no sheet to clear. */
function RemoveDialog({ kind, overSheet = false }) {
  const { title, body } = REMOVE_CONFIRM_COPY[kind];
  const dialog = (
    <DialogSurface
      onScrimPress={() => {}}
      title={title}
      body={[body, "This is immediate and permanent."]}
      actions={
        <>
          <Button variant="text">Remove</Button>
          <Button>Keep it</Button>
        </>
      }
    />
  );
  return overSheet ? <div style={{ position: "fixed", inset: 0, zIndex: 43 }}>{dialog}</div> : dialog;
}
/* WHAT THE LICENSE ROW OPENS (readme §13, the menus round). The terms come up
   from the bottom edge over the surface the reader asked from, and go back to
   it the way any sheet does — the scrim, the swipe, Escape. A block unfolded
   inside a post had no such way back, which is the whole reason this is a
   sheet.

   BOARD GLUE, not a master — the `DetailHeader` rule: masters stacked with the
   sheet's own gutter and no new drawing between them. `LicenseTerms` draws the
   terms here exactly as the read side has always drawn them.

   IT CARRIES NO `SheetTitle`. The inset heads itself — its caption is the words
   the reader tapped, and the public-domain word rides that same line — so a
   title above it would say License terms twice, a few pixels apart, in two
   sizes. The sheet's name lives on the `aria-label`, which is where a screen
   reader asks for it.

   `stacked` is for the copy that comes up over the comments thread: a sheet over
   a sheet takes the layer above, so its wash dims the thread and its surface
   takes the next rung. Over the post detail there is nothing to stack on. */
function LicenseSheet({ license, stacked = false }) {
  return (
    <BottomSheet open stacked={stacked} ariaLabel="License terms" maxHeight="88%">
      <div style={{ padding: "0 24px" }}>
        <LicenseTerms license={license} />
      </div>
    </BottomSheet>
  );
}

/* Another's profile: no license (a profile declares none) and no citing — the
   word for referencing a person is mentioning (readme §13, the menus round). A
   person is saveable like anything else, and hiding one is the read-side
   comfort this menu is the natural home of (the private-viewer-state round).
   Hide sits last: it is the rarest row and the one that takes something away. */
const PROFILE_MENU = [
  SAVE_ROW,
  { label: "Mention in a new post", onSelect: () => {} },
  { label: "Share this profile", onSelect: () => {} },
  { label: HIDE_ACTOR_LABEL("@ada"), onSelect: () => {} },
];

/* A DELETED ACCOUNT'S MENU (jakob 2026-09-12): the three rows that work on a
   nameless actor. Saving keeps a pointer, sharing sends a page, and hiding acts
   on an ACTOR — none of the three needs a name, and the actor is still there,
   still authoring, still ranking into the reader's feed. Mentioning is the one
   row that does: it stages a Reference at a PERSON and spells their handle in
   the composer, and a redacted actor has no handle to spell. The hide row takes
   its own wording from `HIDE_ACTOR_LABEL`, which is where the master already
   answers the same question. */
const PROFILE_DELETED_MENU = [
  SAVE_ROW,
  { label: "Share this profile", onSelect: () => {} },
  { label: HIDE_ACTOR_LABEL(null, true), onSelect: () => {} },
];

/* Your own profile's menu (the private-viewer-state round): the two private
   lists, then share. Saved and History are the only surfaces in the product
   nobody but the reader can see, and the band's ⋮ is where they hang. */
const OWN_PROFILE_MENU = [
  { label: "Saved", onSelect: () => {} },
  { label: "History", onSelect: () => {} },
  { label: "Share your profile", onSelect: () => {} },
];

/* A device-local recent query — a quiet row, never a record (readme §13). */
function RecentRow({ text }) {
  return (
    <button
      type="button"
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: "var(--touch-target-min)",
        width: "100%",
        border: 0,
        background: "none",
        padding: "0 24px",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--text-secondary)" }}>
        <Icon name="search" size={18} />
      </span>
      <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{text}</span>
    </button>
  );
}

/* The Sky, teased — token colours only: item 16's galaxy, hinted.

   TWO RUNGS OF POINT, AND `secondaryContainer` IS NOT ONE OF THEM. The field
   spends `outline` (far) and `primaryContainer` (near), plus `primary` for the
   most-weighted point — three values that read on both grounds,
   `primaryContainer` being literally the same #ef6c1a in either theme.
   `secondaryContainer` cannot carry a rung here: dark it is #743918, which
   sinks into the ground hard enough to invert the reading (CR 1.38 on the dark
   card against `outline`'s 3.89), so the nearer points came out dimmer than the
   far ones. Size and colour must climb together — a mid-weight point never
   reads fainter than a small one. */
function SkyField({ height = 180 }) {
  return (
    <Raw
      style={{ display: "block", lineHeight: 0 }}
      html={`<svg viewBox="0 0 358 ${height}" width="100%" height="${height}" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <line x1="40" y1="${height * 0.55}" x2="140" y2="${height * 0.3}" stroke="var(--border-hairline)" stroke-width="1"/>
        <line x1="140" y1="${height * 0.3}" x2="230" y2="${height * 0.62}" stroke="var(--border-hairline)" stroke-width="1"/>
        <line x1="230" y1="${height * 0.62}" x2="318" y2="${height * 0.38}" stroke="var(--border-hairline)" stroke-width="1"/>
        <line x1="140" y1="${height * 0.3}" x2="196" y2="${height * 0.14}" stroke="var(--border-hairline)" stroke-width="1"/>
        <circle cx="40" cy="${height * 0.55}" r="7" fill="var(--primary-container)"/>
        <circle cx="140" cy="${height * 0.3}" r="12" fill="var(--primary)"/>
        <circle cx="196" cy="${height * 0.14}" r="4" fill="var(--outline)"/>
        <circle cx="230" cy="${height * 0.62}" r="9" fill="var(--primary-container)"/>
        <circle cx="318" cy="${height * 0.38}" r="6" fill="var(--primary-container)"/>
        <circle cx="286" cy="${height * 0.78}" r="3" fill="var(--outline)"/>
        <circle cx="90" cy="${height * 0.82}" r="4" fill="var(--outline)"/>
      </svg>`}
    />
  );
}

/* The seam — where the ranked results end and the newest tail begins. */
function Seam() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 24px" }}>
      <span style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
      <span
        style={{
          flex: "none",
          fontSize: "var(--text-label-small)",
          lineHeight: "var(--text-label-small--line-height)",
          fontWeight: "var(--text-label-small--font-weight)",
          color: "var(--text-secondary)",
        }}
      >
        Beyond your reach — newest first
      </span>
      <span style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
    </div>
  );
}

/* The searching view's trigger row: the master FilterTrigger (the FeedFilter
   idiom — deviations only, "Everything" at rest) with the "?" on the far edge. */
function SearchTriggerRow({ reading }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, padding: "0 16px 8px 16px" }}>
      <FilterTrigger reading={reading} ariaLabel="What the search shows" />
      <HelpDot />
    </div>
  );
}

/* The "?" — the master, defaulted to this canvas's usual label. Everything else
   the master takes passes straight through; a shim that swallows props is a
   second component wearing the master's name. */
function HelpDot({ ariaLabel = "How searching works", ...rest }) {
  return <SystemHelpDot ariaLabel={ariaLabel} {...rest} />;
}

/* The own-profile band cluster (profile round): the gear as the profile's own
   trailing control — chats and the bell arrive built into the band itself.
   Shared by the member and applicant own-profile boards.

   THE GEAR IS ALL THE BAND CARRIES (the band law, jakob 2026-09-11). Settings
   is this tab's own screen-level control, so it is what `trailing` holds, and
   the ⋮ went down to the actions row beside the other things the page does.
   What the dot holds did not change — Saved, History, Share your profile, the
   private state's one door (readme §13, the private-viewer-state round) — only
   where the reader reaches for it. */
function ProfileBand({ unread = false, children }) {
  return (
    <CograBand unread={unread} trailing={<BandIcon name="settings" label="Settings" />}>
      {children}
    </CograBand>
  );
}

/* Your own profile's ⋮, in the one place it now stands: closing the actions
   row, after Edit profile and Invites. Written once, so the three boards that
   draw your own header cannot disagree about what the dot holds. */
const ownProfileMenu = () => <OverflowMenu placement="row" ariaLabel="More on your profile" items={OWN_PROFILE_MENU} />;

/* Another person's ⋮, likewise: closing their actions row after Message. */
const otherProfileMenu = () => <OverflowMenu placement="row" ariaLabel="More about @ada" items={PROFILE_MENU} />;

/* A deleted account's ⋮, closing a row that has no Message to stand after. Its
   name says `this account` for `StanceControl`'s reason on the same row: the
   handle went with the rest of the identity, and naming it back in the one
   string a screen reader reads aloud would undo the redaction. */
const deletedProfileMenu = () => (
  <OverflowMenu placement="row" ariaLabel="More about this account" items={PROFILE_DELETED_MENU} />
);

/* The chronicle's tab row (profile round, 2026-09-01): the `TabBar` master
   holding the chronicle's own three glyphs. What lives here is the tab data —
   the row itself is the one every list-choosing surface draws, and the icon
   cells take their accessible names from these labels, which is the only way
   an icon-only control gets one.

   The chronicle's cards are `ContentRow`'s `chronicle` variant, written where
   they are read: each act its own card on the surface-card ground, a leading
   disc carrying the act's kind (a glyph, or the stance record's own face),
   the verb and its snippet, the time on the trailing edge, Still settling
   where an act pends. A card with somewhere to go is a button; a record with
   no destination is the same card, `inert`. */
const CHRONICLE_TABS = [
  { id: "posts", icon: "dynamic_feed", label: "Posts" },
  { id: "comments", icon: "chat_bubble", label: "Comments" },
  { id: "everything", icon: "history", label: "Everything" },
];
/* The tab strip's own name, assigned beside the tabs it names — a decided copy
   string is an atom (readme, Masters and atoms), and five boards spelling it
   out is five chances for one of them to say something else. */
const CHRONICLE_TABS_LABEL = "What the chronicle shows";

/* The chronicle column: cards on 8px of surface, the wallet history's seam. */
function ChronicleList({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px 0" }}>
      {children}
    </div>
  );
}

/* THE SAVED ROW'S OWN UNSAVE (jakob 2026-09-11). Sending a reader back to the
   thing's own ⋮ to undo what is in front of them is the long way round, and the
   Saved list is the one place where every row offers the same act. It is
   ICON-ONLY — the filled bookmark, `Unsave` in the accessibility tree, no word
   on screen (jakob: with the icon "we dont even need any word there") — because
   the same word repeated down a list is four copies of one sentence, and this
   glyph is one every reader already reads as "kept".

   IT TAKES THE CHEVRON'S SLOT, NEVER THE AGE'S. The age is when YOU saved the
   thing, which is this list's whole order and what a reader is retracing, so it
   keeps its place and the control stands outboard of it. The chevron was never
   drawn here — a row that opens says so by being a row — so the edge was already
   free. The glyph takes `text-secondary`, the colour every icon-only control in
   this system rests in: it is the row's control, not a badge saying the row is
   saved. Every row in this list is.

   It lives here because the list is drawn on more than one board — at rest and
   in the moment after a row goes — and a control spelled twice is a control
   that drifts. */
const Unsave = () => (
  <button
    type="button"
    aria-label="Unsave"
    className="cg-state cg-focus cg-hit"
    style={{
      display: "grid",
      placeItems: "center",
      height: "40px",
      width: "40px",
      border: 0,
      background: "none",
      borderRadius: "var(--radius-full)",
      color: "var(--text-secondary)",
      cursor: "pointer",
      padding: 0,
    }}
  >
    <Icon name="bookmark" size={22} />
  </button>
);

/* The post-detail column: the read surface a card opens into. */
function DetailColumn({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, padding: "0 0 8px 0" }}>
      {children}
    </div>
  );
}

/* ── The thread, and the post it hangs under (readme §13, the menus round) ──
   Both were ReplyEntry's alone until the comment's overflow menu needed the
   same thread with a second sheet over it. A body on a second screen stops
   being screen-local — so the sheet and the detail beneath it moved here whole,
   and the two boards differ only by what is stacked on top. */

function ThreadDetail({ menuItems = READER_POST_MENU }) {
  return (
    <>
      <DetailHeader items={menuItems} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}

/* Your own profile, whole — shared the moment the band's ⋮ opened a sheet over
   it (readme §13, the private-viewer-state round). The page is now drawn on
   three boards, and one drawing is what keeps the three from disagreeing about
   what your own profile holds.

   `tail` is the chronicle's last slot: the row a page-failure puts where the
   next page would have been. Given none, the list simply ends. */
function ProfileOwnBody({ tail = null }) {
  return (
    <>
      <ProfileBand />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="sol"
            displayName="Sol Ferreira"
            bio="Field notes from the flats — salt, paper, and whatever the wind allows."
            website="solferreira.art"
            posts={5}
            stancesOn={9}
            stancesTaken={14}
            own
            /* AN APPLICATION IS WAITING (the invites round). @rafa's proofs
               are both in and nobody but Sol can act on it, so the row that
               opens the queue wears the bell's dot. It is the one way the
               queue's owner learns without going looking — and the count, which
               would turn a fact into an errand, waits in the list itself. */
            invitesWaiting
            onEdit={() => {}}
            onInvites={() => {}}
            onAvatarChange={() => {}}
            onCounts={() => {}}
            menu={ownProfileMenu()}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="everything" tabs={CHRONICLE_TABS} />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="3d" second="Salt maps of the coast road — rubbings from three weekends at low tide." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="chat_bubble" title="Commented" trailing="4d" second="The third headland light is real — I have a print from 2019 that almost catches it." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.4, pInterest: 0.5 }} title="Gave an opinion" titleAside="on @mira" trailing="5d" inert />
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="7d" second="Three weekends of walking the same stretch at low tide." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="person" title="Updated your profile" trailing="14d" inert />
          {tail}
        </ChronicleList>
      </div>
      <BottomNav active="profile" slots={ALL_SLOTS} inline />
    </>
  );
}

/* Someone else's profile, whole — shared the moment its own overflow menu
   needed the same page with a sheet over it (readme §13, the menus round).

   THE HEADER BAR CARRIES ONLY THE WAY BACK (the band law, jakob 2026-09-11).
   The ⋮ came down into the actions row, where Message gave up the half of the
   row it did not need; a detail surface's top bar is where a reader looks for
   the way out, and this page's rare acts belong beside its common ones.

   THE WAY BACK NAMES WHERE IT GOES — the profile's origin-noun table (readme
   §13, the navigation-and-sheets round). The board draws `Back to feed`, the
   cold entry's label and the feed's alike. */
function ProfileOtherBody({ bundle } = {}) {
  return (
    <>
      <PageHeader title="@ada" backHref="#" backLabel="Back to feed" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="ada"
            displayName="Ada Okonkwo"
            avatarSrc="comment-camera.jpg"
            bio="A dozen tries at the third headland light and counting."
            posts={12}
            stancesOn={48}
            stancesTaken={31}
            bundle={bundle}
            onCounts={() => {}}
            onCommit={() => {}}
            onMessage={() => {}}
            menu={otherProfileMenu()}
            showHandle={false}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="everything" tabs={CHRONICLE_TABS} />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="2h" second="The long way home — the light does something at the third headland." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="chat_bubble" title="Commented" trailing="1d" second="The glovebox camera earns its keep — this is the print from 2019." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.6, pInterest: 0.3 }} title="Gave an opinion" titleAside="on @tobias" trailing="2d" inert />
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="5d" second="Took the coast road instead of the tunnel. Four hours longer, worth every minute." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="person" title="Updated their profile" trailing="7d" inert />
        </ChronicleList>
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

/* A deleted account's profile, whole — shared for the same reason
   `ProfileOtherBody` is: its own ⋮ needs this page with a sheet over it, and a
   husk drawn twice would drift. The page's reasoning lives on `ProfileDeleted`;
   what matters here is that the sheet board gets the identical husk, so the two
   boards differ by the sheet alone. */
function ProfileDeletedBody() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to feed" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="marlow"
            redacted
            bio={<RedactedContent reason="account" when="3d" />}
            posts={7}
            stancesOn={22}
            stancesTaken={19}
            onCounts={() => {}}
            onCommit={() => {}}
            menu={deletedProfileMenu()}
            showHandle={false}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="everything" tabs={CHRONICLE_TABS} />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="9d" second="Three mornings on the wall, watching the tide come in over the flats." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="chat_bubble" title="Commented" trailing="12d" second="The tunnel is faster; the coast road is the reason to drive at all." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.5, pInterest: 0.3 }} title="Gave an opinion" titleAside="on @sol" trailing="14d" inert />
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="21d" second="Low sun on the salt crust, and nobody else out there." onOpen={() => {}} />
        </ChronicleList>
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}

/* THE REPLY WIZARD'S FIRST STAGE, whole (legacy conversion, lane C): the thing
   being answered, the words being written, the way to add pictures to them, and
   the foot. It lives here for the KeyPledge reason — `DiscardConfirm` draws
   this same composer under its dialog, and a body on a second board stops being
   board-local. Drawn once, the two boards cannot disagree about what the
   composer's "+ Add" offers, which is exactly what the hand copies had done. */
/* WHAT A REPLY ANSWERS, AS ITS SURFACES NAME IT (the reply pack, jakob
   2026-09-30). A reply answers a post or a comment, and the substrate is the
   same either way — the reply reviews what it answers, and its stance is
   toward that — so the composer and the seal are one surface each, and only
   the lines that NAME the target differ. Every other word on them is
   target-neutral.

   A post is named by its title and its author's handle. A comment has no
   title, so it is named by its author's handle alone, and its words are the
   quote's taste. The composer pre-fills nothing — a typed @handle is text,
   never a record, and the thread shows what a reply answers by where it
   stands. */
const REPLY_TARGETS = {
  post: {
    quoted: {
      title: "The long way home — @ada",
      snippet: "The light does something at the third headland that I have never managed…",
      name: "Ada Okonkwo",
      src: "comment-camera.jpg",
    },
    note: 'Reply to "The long way home"',
    act: "Reply to @ada's post",
  },
  comment: {
    quoted: { title: "@tobias", snippet: TOBIAS_COMMENT, name: "Tobias Lindqvist" },
    note: "Reply to @tobias",
    act: "Reply to @tobias's comment",
  },
};

/* THE REPLY'S WORDS ARE A FIELD (jakob, 2026-10-01): `WordsBody`'s box at a
   minimum of three lines — `CommentEdit`'s own minimum for the same words —
   capped at a comment's 2,000 characters. Every reply composer board draws it
   from these two numbers, so the composer cannot disagree with itself. */
const REPLY_WORDS_ROWS = 3;
const REPLY_WORDS_CAP = 2000;

function ReplyDraft({ target = "post" } = {}) {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuotedRow {...REPLY_TARGETS[target].quoted} />

        <WordsBody rows={REPLY_WORDS_ROWS} cap={REPLY_WORDS_CAP} paragraphs={["The third headland light is real — I have a print from 2019 that almost catches it. Almost."]} />

        <InlineAction size="sm" selfStart>+ Add pictures or a video</InlineAction>

        <div style={{ flex: 1 }} />

        <QuietNote>Words first — pictures can join them.</QuietNote>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}

/* THE COMPOSE WIZARD OPENED ON A DRAFT, whole. It lives here for `ReplyDraft`'s
   reason — `ComposeDraftDiscard` draws this same stage under its dialog — and
   for a second one: this is the shape both clients hold to, so a body copied
   per board is a divergence waiting to be shipped twice.

   THE SHAPE IS WEB'S, EVERYWHERE (jakob 2026-09-15: "yes web everywhere"). Web
   dims the pick region AND takes it out of reach — pointer, keyboard and
   assistive tech together — while Android dims it and leaves it tappable, so
   the same screen answers a tap in two different ways. One of those is the
   drawing: the region under an unanswered draft is not operable.

   THE DRAFT IS PROMINENT, AND IT IS PROMINENT THE WAY EVERY OTHER CARD THE
   PRODUCT SPEAKS THROUGH IS (jakob: "maybe we should make the draft more
   prominent.. right now it is easy to just wonder why you cant act"). It wears
   `--ring-task`, the same brand edge a `TaskCard` wears in a feed, because it
   is the same fact: this card is the product addressing the reader, and it is
   the one thing on the screen that can be acted on. The dim beneath it stays at
   its blessed 0.55 — the ruling asked for a louder draft, not a fainter roll,
   and both clients already hold that number.

   AND A TAP ON THE ROLL ANSWERS (jakob: "i guess clicking the images should
   also start the discard process (open the popup).. else people might just
   click the images and wonder why nothing happens"). Inert content that
   swallows taps is the failure the ruling names, so the roll carries a shield:
   one transparent control over the whole region, named for what it will say,
   raising the draft's own pair as a dialog. It is a CONTROL and not a handler
   on a dead region, so the keyboard and a screen reader reach the same answer
   the thumb does — and the tiles underneath stay unreachable, which is what
   keeps the draft's pair the only pair on the board. */
const DRAFT_TILE = { position: "relative", width: 125, height: 125 };
const DRAFT_FILL = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const DRAFT_SHADES = [
  "var(--surface-container-low)",
  "var(--surface-container)",
  "var(--surface-container-high)",
  "var(--surface-container-highest)",
  "var(--surface-container)",
  "var(--surface-container-highest)",
  "var(--surface-container-low)",
];

function ComposeDraftBody() {
  return (
    <>
      <WizardHeader title="New post" />

      <Card
        style={{
          flex: "none",
          margin: "8px 24px",
          boxSizing: "border-box",
          border: "var(--ring-task-width) solid transparent",
          background:
            "linear-gradient(var(--surface-card), var(--surface-card)) padding-box, var(--ring-task) border-box",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
          Your draft is here
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MediaThumb src="post-photo.jpg" size={40} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)" }}>
              Salt maps of the coast road
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              2 pictures — kept on this device
            </span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text">Discard</Button>
          <Button>Continue</Button>
        </div>
      </Card>

      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 24px" }}>
        <p style={{ margin: 0, flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
          Or start fresh —
        </p>
      </div>

      {/* The roll, waiting: dimmed and out of reach, with the shield over it. */}
      <div style={{ position: "relative", flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 3, padding: "4px 4px 0", overflow: "hidden", alignContent: "flex-start", opacity: 0.55 }}>
          <div style={{ ...DRAFT_TILE, overflow: "hidden" }}>
            <img src="post-photo.jpg" alt="" style={DRAFT_FILL} />
          </div>
          <div style={{ ...DRAFT_TILE, overflow: "hidden" }}>
            <img src="inviter.jpg" alt="" style={DRAFT_FILL} />
          </div>
          {DRAFT_SHADES.map((background, index) => (
            <div key={index} style={{ ...DRAFT_TILE, background }} />
          ))}
        </div>
        <button
          type="button"
          aria-label="Answer your draft before starting a new post"
          className="cg-focus"
          style={{ position: "absolute", inset: 0, border: 0, background: "none", padding: 0, cursor: "pointer" }}
        />
      </div>
    </>
  );
}

/* THE REPLY SEAL'S ADD-ROWS — a primary word where a value would sit, so what
   you could still add lines up with what you have already added. They are
   `ActsCard`'s action rows: the whole row is the control, because a word whose
   only slot clips its overflow is a word whose 48px target is cut back to the
   ink. Truncation belongs to the value slot, and an action row has none.

   They live here because BOTH reply seals draw them — the bare one and the one
   with a reference staged are one surface in two states, and a row spelled
   twice is a row that drifts. */
const ADD_ROWS = [
  { label: "", action: "+ Add a tag", count: "1 more" },
  { label: "", action: "+ Cite something", count: "1 more" },
];

/* ── THE SEAL'S REFERENCES ROW, IN ITS TWO READINGS (jakob's rulings
   2026-09-14, backlog item 70) ───────────────────────────────────────────────
   ONE staged citation reads back as itself — the name, and the pair that rides
   with it — because a seal is a read-back and one thing read back is the thing.
   TWO OR MORE read back as their COUNT: "3 cited", one line, and the row is a
   DOOR to `CitedSheet`. Ten names stacked in an act row is a seal that scrolls,
   and a seal that scrolls has stopped being a read-back; a count with no way
   through to what it counts is a number the reader cannot check. The row flat
   and the list one tap behind it is what keeps both promises.

   THE TRAILING COUNT IS THE CITATIONS, BARE. The list's length and nothing else
   — one number, one fact, which is `RefsSheet`'s ruling said again on this side
   of the composer. It is not the signature's act total: that number is the
   card's own footer and already says what it counts.

   THE SAME RULE GOVERNS BOTH SEALS. It is about citations, not about which
   composer staged them — so the reply's seal counts at two exactly as the
   post's does, and both doors open the one sheet. What differs is the single
   reading each seal was drawn with, which this round does not touch.

   THE DOOR'S NAME CARRIES THE COUNT (jakob's ruling 2026-09-14, ruling 8). An
   `aria-label` REPLACES what it names, so the row's whole reading — the hidden
   digit and the "3 citations" paired with it — went unheard behind "Manage the
   citations": a listener was given the verb at the price of the number, which
   is the one thing the row exists to say. The name carries it, bare count and
   the row's own noun, the regular plural the card adds to `countNoun` said
   here in the same words. ONE FACTORY WRITES BOTH SEALS' ROW, so the compose
   seal and the reply seal changed together and cannot disagree. Nothing is
   drawn differently. */
const citedRow = (count) => ({
  label: "References",
  value: `${count} cited`,
  count: String(count),
  countNoun: "citation",
  onOpen: () => {},
  openLabel: `Manage the ${count} ${count === 1 ? "citation" : "citations"}`,
});

/* ── THE SEAL'S TAGS ROW, IN ITS TWO READINGS (jakob's ruling 2026-09-15) ────
   THE CHIPS ARE THE READING WHILE THEY FIT. Two short names are shorter than
   the sentence that would count them, and a seal is a read-back: what you
   signed, in the words you chose. Past what the slot holds the row went on
   drawing chips the value slot then clipped — two and a half pills beside a
   count that said seven — which is the same defect `citedRow` closes one row
   below, arriving from the other direction.

   SO THE OVERFLOW IS THE REFERENCES' SHAPE, not a second invention of it:
   "7 tags", one line, and the row a DOOR. The seal stays one screen tall at
   any number of tags, and the count stays checkable — the pair of promises
   that rule exists for.

   THE NOUN IS THE READER'S. A `#name` is a TAG on screen and a topic in the
   record (copy-voice.md, *Naming*), so the row counts tags — the word
   `TopicsLine` already uses where the feed folds a tag list into its
   remainder, said again on this side of the composer.

   WHERE THE DOOR LEADS IS `TagsSheet`, OVER THE SEAL — the References row's
   own destination with tags in it (backlog item 95, ruled the batch-rulings
   round). The two rows fold for one reason and promise one thing, so they open
   one kind of door; the seal has one grammar and not two.

   THE TWO FOLDS STILL DIFFER, AND THEY DIFFER DELIBERATELY (backlog item 96,
   ruled the same round). `TopicsLine` keeps sample chips beside its remainder
   because the reader's glance wants SCENT — enough of the list to judge whether
   to look. A seal is a read-back before a signature, so its row folds WHOLLY
   and its door shows the complete list, exactly as its References sibling does.
   One surface is being skimmed and the other is being checked; a single fold
   would serve one of them badly. */
const tagsRow = (count) => ({
  label: "Tags",
  value: `${count} tags`,
  count: String(count),
  countNoun: "tag",
  onOpen: () => {},
  openLabel: `Manage the ${count} ${count === 1 ? "tag" : "tags"}`,
});

/* What the seal was drawn holding, and what a well-tagged post holds. Spelled
   once because two states draw them: the row that reads the names back and
   the row that counts them. */
const SEAL_TAGS = ["fieldnotes", "coastroad"];
const SEAL_TAGS_MANY = ["fieldnotes", "coastroad", "saltmaps", "tidal", "estuary", "cartography", "lowtide"];

/* HOW MANY CHIPS THE ROW HOLDS — the capacity of the value slot the card
   leaves between its 76px label and its count, not a taste. The fold begins
   where the drawing stops being readable. */
const TAGS_ROW_HOLDS = 2;

/* The post's staged set past the first, written once: the seal that COUNTS
   these and the sheet that LISTS them are two boards of one moment, and a
   count drawn beside a list it disagreed with would be the very defect this
   round closes. A post and a person among them on purpose — a cite stages a
   post and a mention stages a person, and the block cannot tell them apart
   because there is nothing to tell apart. */
const SEAL_CITATIONS = [
  { kind: "post", name: "The long way home — @ada", sub: "Post", src: "post-photo.jpg", pair: { pDirected: 0.1, pInterest: 0.1 }, onRemove: () => {}, onEdit: () => {} },
  { kind: "person", name: "Mira Voss", sub: "Person", pair: { pDirected: 0.4, pInterest: 0.3 }, onRemove: () => {}, onEdit: () => {} },
  { kind: "post", name: "Tide tables and the third headland — @juno", sub: "Post", pair: { pDirected: -0.2, pInterest: 0.1 }, onRemove: () => {}, onEdit: () => {} },
];

/* THE KEPT PICKS, written once (backlog item 113, the kept picks' review):
   the review that lists them and the seal that signs them are two boards of
   one batch, and a seal reading back a set the review disagreed with would
   be the drift this constant exists to stop. Three, because the settings row
   that reopens the review counts three. The first is `PadPending`'s own pick
   on @ada's post; a person among them on purpose, since every pad that meets
   the key's absence can keep its pick (`PadKeyAbsent` is the master for all
   of them). Each pair is read the readout's way on both boards — the face,
   the digits in geek mode, and the anchor's word with both axes spoken
   (`StagedReference`'s `stance` on the review, `StanceReadout` on the
   seal).

   THE THREE ROWS ARE THE REVIEW'S THREE STATES (jakob 2026-10-02, the
   fix-fix round's 21). @ada's post is a plain pick. Mira's pick nets the
   reader's standing bundle toward her to nothing — it is the exact opposite
   of what they had said — so its row carries `consequence`, the person's
   landing words. @juno's post was removed by its author while its pick
   waited, so its row carries `removed`, the target's removal mark, and both
   boards draw the mark where the name stood. */
const KEPT_PICKS = [
  { kind: "post", name: "The long way home — @ada", sub: "Post", src: "post-photo.jpg", pair: { pDirected: 0.1, pInterest: 0.1 } },
  { kind: "person", name: "Mira Voss", sub: "Person", pair: { pDirected: 0.55, pInterest: 0.2 }, consequence: "This takes you back to zero." },
  { kind: "post", name: "Tide tables and the third headland — @juno", sub: "Post", pair: { pDirected: -0.15, pInterest: 0.15 }, removed: "Removed by its author" },
];

/* The one citation the reply's seal was drawn holding. It is a constant rather
   than a board's literal because two states of that seal name it — the one
   that reads it back and the × that drops it. */
const REPLY_CITATION = "Tide tables and the third headland";

/* ── WHAT AN OVERLAY SITS ON (jakob's ruling, 2026-09-08) ──────────────────
   A sheet, a dialog or a wash covers the surface the reader came from, and
   that surface is the real one — not a shortened stand-in of it. An overlay
   board therefore draws the board beneath it whole, and each of those bodies
   is written once here for the `KeyPledge` reason: a body on a second board
   stops being board-local, and three sketches of one seal are three chances
   to disagree about it.

   The bodies stay inert under their overlay — the boards say so in their
   `scanExempt` lines — so nothing here is wired; it is drawn. */

/* THE POST'S SEAL, whole — `ComposeSeal` itself, and what the opinion pad, the
   license sheet, the sensitive sheet and the "?" dialog stand on.

   `state` IS WHAT BECAME OF THE COMMIT (the failure pack, jakob 2026-09-30).
   One body, so the seal a fault is drawn on is the seal the reader was on:
   - `signing` — past 200ms without an answer: the commit reads its present
     participle and goes inert, and the ways out with it (`SealSigning`).
   - `slow` — the same signing past 5s: the acts card's subline swaps to the
     slow line in olive, and nothing else changes (`SealSigningSlow`).
   - `offline` — no answer at all: the fault takes the commit's place,
     `TransportError`'s line over an outlined Retry and the same way back
     (`NetworkError`).
   - `refused` — a cited post that never landed: its row says so with Remove
     it, and the commit stays, because nothing was staged (`SealFaultRow`).
   - `bug` — any other refusal of one staged act, which the picking stage
     should have blocked: the commit's place takes `NoticePanel` in the bug's
     words, with Try again, and Report a problem and Discard the post under
     it (`SealFaultBug`).
   - `writeRule` — the write rule's refusal: nothing failed and nothing was
     spent, so the commit's place takes `NoticePanel`, and the way out keeps
     the draft (`WriteRuleFailed`). */
const SEAL_UNLANDED_CITATION = "This post didn't land, so it can't be cited.";
const SEAL_BUG_TITLE = "This shouldn't have happened";
const SEAL_BUG_FACT = "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it.";
const WRITE_RULE_TITLE = "You can't sign right now";
const WRITE_RULE_FACT =
  "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent — your draft is kept.";
/* The write rule's own "?" — the stopper exception (jakob 2026-10-01). The
   header's "?" explains signing; this one explains how the stop resolves, so
   it rides the notice panel and is named by its dialog (copy-voice, *The "?"
   dialogs*). The pad's notice carries the same one. */
const WRITE_RULE_HELP = "Why signing waits";
/* The slow line (jakob 2026-10-01: past 5s, an honest line and no fake
   progress) — a draft flagged for blessing (copy-voice, *Faults by code*). */
const SEAL_SLOW_LINE = "Still signing — the network is slow right now.";

function ComposeSealBody({ cited = 1, tags = SEAL_TAGS, state }) {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Salt maps of the coast road", count: "1", countNoun: "post" },
            tags.length > TAGS_ROW_HOLDS
              ? tagsRow(tags.length)
              : {
                  label: "Tags",
                  value: (
                    <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                      {tags.map((tag) => (
                        <Chip key={tag} label={`#${tag}`} tone="readout" />
                      ))}
                    </span>
                  ),
                  count: String(tags.length),
                  countNoun: "tag",
                },
            cited > 1
              ? citedRow(cited)
              : {
                  label: "References",
                  countNoun: "citation",
                  /* The staged citation carries its own pair, so the row is two
                     lines: what is cited, and what signing it says about the
                     citer. */
                  value: (
                    <span style={{ display: "flex", flexDirection: "column", padding: "6px 0", minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>The long way home — @ada</span>
                      <StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />
                    </span>
                  ),
                  count: "1",
                  ...(state === "refused" ? { fault: { message: SEAL_UNLANDED_CITATION, onRemove: () => {} } } : null),
                },
          ]}
          total={`${1 + tags.length + cited} things, signed together`}
          note={state === "slow" ? SEAL_SLOW_LINE : "They land together, or none does."}
          noteTone={state === "slow" ? "slow" : "quiet"}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value={<LicenseSummary />} action="Change" />
          {/* One number: what reaches you about your own post is not a choice,
              so the row states the one value the author set. */}
          <FactRow
            label="Your opinion"
            value={<OwnStanceReadout pDirected={0.1} />}
            action="Adjust"
          />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        {state === "offline" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TransportError message="That didn't send. Try again." />
            <Button variant="outline" style={{ width: "100%" }}>Retry</Button>
            <Button variant="text" style={{ width: "100%" }}>Back</Button>
          </div>
        ) : state === "writeRule" ? (
          <>
            <NoticePanel title={WRITE_RULE_TITLE} helpLabel={WRITE_RULE_HELP} onHelp={() => {}}>
              <NoticeLine>{WRITE_RULE_FACT}</NoticeLine>
            </NoticePanel>
            <Button variant="text" style={{ width: "100%" }}>Keep the draft, sign later</Button>
          </>
        ) : state === "bug" ? (
          <>
            {/* Not a fault in `--error`, and not the write rule's notice: the
                reader did nothing wrong and nothing was spent, so it is the
                tertiary panel, and its words own the bug. */}
            <NoticePanel title={SEAL_BUG_TITLE}>
              <NoticeLine>{SEAL_BUG_FACT}</NoticeLine>
              <Button variant="inverse" style={{ width: "100%" }}>Try again</Button>
            </NoticePanel>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Button variant="text" style={{ width: "100%" }}>Report a problem</Button>
              <Button variant="text" style={{ width: "100%" }}>Discard the post</Button>
            </div>
          </>
        ) : (
          <SealFooter signLabel="Sign and publish" busy={state === "signing" || state === "slow"} busyLabel="Signing and publishing…" />
        )}
      </div>
    </>
  );
}

/* THE REPLY'S SEAL, whole — `ReplySeal` itself, and what the reply's opinion pad
   stands on. */
/* The reply's parked pad over its seal — `ReplyPad`'s whole drawing, lifted
   here the moment a second board needed it (the help dialog opened from its
   "?"). Same rule as `ReplySealBody` and `ProfileOtherBody`: what a modal
   covers is inert, not shortened, so the board underneath must be the real
   one and not a stand-in — and the way to guarantee that is one markup, two
   screens. */
function ReplyPadBody() {
  return (
    <>
      <ReplySealBody />

      {/* The wash over the shell; the parked pad above it stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />

      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          bottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          borderRadius: "var(--radius-extra-large)",
          background: "var(--surface-dialog)",
          color: "var(--on-surface)",
          padding: "var(--card-padding)",
          boxSizing: "border-box",
        }}
      >
        <span style={{ position: "absolute", top: 4, right: 4 }}>
          <HelpDot ariaLabel="Toward what you answer" />
        </span>

        {/* The pick's readout, above the field where a thumb cannot cover it:
            what the pick is toward, then the face and the pair under it. The
            readout clears the corner the "?" sits in. */}
        <div style={{ display: "flex", flexDirection: "column", paddingRight: 40 }}>
          <span aria-hidden="true" style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            Toward what you answer
          </span>
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
            <span className="cg-exact" style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.10 / +0.10</span>
          </span>
          <span style={SR_ONLY}>
            Nice, For or against +0.10, How much reaches you +0.10
          </span>
        </div>

        <div role="group" aria-label="Opinion pad for what you answer" style={{ alignSelf: "stretch" }}>
          <StancePad value={{ pDirected: 0.1, pInterest: 0.1 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text" size="sm">Cancel</Button>
          <Button size="sm">Set</Button>
        </div>
      </div>
    </>
  );
}

/* THE REPLY'S ONE STAGED CITATION, as the comment's seal was drawn holding it:
   the name that opens the citation's pair, and the × that drops it, each naming
   the citation it acts on (`StagedReference`'s rule, jakob 2026-09-10). The
   label is singular here — it names the EDGE staged rather than the block it
   sits in (copy-voice), and one edge is a reference. */
const replyCitedRow = () => ({
  label: "Reference",
  countNoun: "citation",
  value: (
    <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
      <button
        type="button"
        aria-label={`${REPLY_CITATION} — set how it relates`}
        className="cg-state cg-focus"
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", border: 0, background: "none", padding: 0, borderRadius: "var(--radius-small)", color: "inherit", font: "inherit", letterSpacing: "inherit", textAlign: "left", cursor: "pointer" }}
      >
        {REPLY_CITATION} — @juno
      </button>
      <button
        type="button"
        aria-label={`Remove ${REPLY_CITATION}`}
        className="cg-state cg-focus"
        style={{ flex: "none", display: "grid", placeItems: "center", height: 32, width: 32, border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
      >
        <Icon name="close" size={18} />
      </button>
    </span>
  ),
  count: "1",
});

/* THE REPLY'S SEAL IS ONE SURFACE IN THREE STATES, and `cited` is which one:
   nothing staged, the one citation read back, or the count and its door. A
   comment's seal is also its details stage, so the add-rows ride along in every
   state — what could still be added, lined up with what has been.

   `target` is what the reply answers (`REPLY_TARGETS`): only the read-back
   line and the act row's value name it. `keyAbsent` is the seal with the key
   elsewhere (`ReplySealKeyAbsent`) — every row unchanged, the key notice where
   the footer stood, and the header's "?" kept beside the notice's own, by the
   stopper exception (readme §13, *The failure fixes and the support stack*).

   `uploading` is the seal gated on the reply's media (jakob's ruling, the night
   batch 2026-10-01 — audit K6.2): `{ done, total }` while they go up, `{ failed:
   true }` once one has not, with `media: "video"` for a clip so the line
   reads `…signing waits for the video.` (jakob 2026-10-02, pads 3). Every
   row is unchanged; `UploadStatusLine` stands over the foot. While the
   uploads run, `Sign comment` stays enabled and, pressed, swaps to `Signing
   comment…` until the bytes land and the signing answers (the fix-fix
   round's 20, `ReplySealUploading`); at the failed reading it is disabled
   (`ReplySealUploadFailed`). */
function ReplySealBody({ cited = 0, target = "post", keyAbsent = false, uploading = null }) {
  const named = REPLY_TARGETS[target];
  return (
    <>
      <WizardHeader
        title="What you sign"
        leaveLabel="Leave — the reply is discarded"
        stageLabel="Last step"
        help="How signing works"
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>{named.note} — 89 characters.</QuietNote>

        {/* The all-or-nothing subline appears the moment a signature carries
            more than one thing (`ActsCard`'s rule), so the bare comment —
            one act signed — draws neither it nor the plural total. */}
        <ActsCard
          rows={[
            { label: "Comment", value: named.act, count: "1", countNoun: "comment" },
            ...(cited === 1 ? [replyCitedRow()] : cited > 1 ? [citedRow(cited)] : []),
            ...ADD_ROWS,
          ]}
          total={cited ? `${1 + cited} things, signed together` : "1 thing, signed"}
          note={cited ? "They land together, or none does." : undefined}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow
            label="Toward what you answer"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            action="Adjust"
          />
          <FactRow label="License" value={<LicenseSummary />} action="Change" />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        {/* The opinion the reply carries is a fact about replying, not about
            this row — so it stands under the ruled block rather than inside
            it, where `FactRow` has no slot for it. */}
        <QuietNote>Replying also signs an opinion on what it answers.</QuietNote>

        <div style={{ flex: 1 }} />

        {keyAbsent ? (
          <>
            <KeyAbsentNotice line="A reply can't wait as pending — restore the key to sign this one." />
            <Button variant="text" style={{ width: "100%" }}>Discard the reply</Button>
          </>
        ) : (
          <>
            {uploading &&
              (uploading.failed ? (
                <UploadStatusLine failed onRetry={() => {}} />
              ) : (
                <UploadStatusLine done={uploading.done} total={uploading.total} media={uploading.media} />
              ))}
            <SealFooter signLabel="Sign comment" busyLabel="Signing comment…" disabled={Boolean(uploading && uploading.failed)} />
          </>
        )}
      </div>
    </>
  );
}

/* THE KEY NOTICE AT REPLY SCALE — `ComposeKeyAbsent`'s panel, which is
   `PadKeyAbsent`'s: `NoticePanel` at the `medium` corner, a
   `tertiary-container` block (a waiting state, never `error`), the "?" in `HelpDot`'s `inverse` naming the
   key, one line, and the restore button in `Button`'s `inverse`. Written once
   here because the reply's door and the reply's seal both draw it.

   For a reader with no backup it takes `KeyElsewhereNoBackup`'s two changes,
   like every key-absent notice: the line becomes that card's no-backup
   sentence, and the restore button is not drawn. */
function KeyAbsentNotice({ line }) {
  return (
    <NoticePanel title="Your key isn't on this browser" helpLabel="Your key">
      <NoticeLine>{line}</NoticeLine>
      <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
    </NoticePanel>
  );
}

/* THE GROWING BODY FIELD — the box a words body is written in. It is NOT a
   `TextField`: the master's field is a `<textarea rows={n}>`, a fixed number
   of lines holding one string, and neither this height nor these paragraphs
   survive one. So it is spelled at `TextField`'s own values — the extra-small
   corner, the field border, `body-large` inside — and the caret is the
   system's `Caret`, because the field is always shown mid-writing.

   It lives here because the words STAGE and the words EDIT both draw it, and
   a body on a second board stops being board-local (`ReplyDraft`'s reason).
   The caret rides the last paragraph wherever the box is drawn.

   IT CARRIES THE LATE COUNTER LIKE ANY OTHER CAPPED FIELD. The box is not a
   `TextField`, so it renders the atom's own `FieldSupport` row rather than
   inheriting it — one reading, one threshold, one formatter, one geometry under
   the field, whatever the field is made of.
   `used` is what the counter counts here: a body near 5,000 characters is far
   longer than the box shows, and the paragraphs drawn are the visible tail of
   it, so a count taken from them would be a lie about what is written. Over the
   cap the box takes the `--error` outline and the surface's own refusal renders
   under it, which is `TextField`'s arrangement exactly.

   `rows` IS THE GROWTH LAW'S MINIMUM (readme §13, the sheets-and-video round).
   Without it the box takes the whole column, which is the post's body: the
   post IS its words. Given, the box opens at that many lines and grows with
   the writing — `TextField`'s own `rows` rule — which is the reply composer's
   words, written above what they answer and the pictures that join them. The
   board draws the minimum, as every field does. */
function WordsBody({ paragraphs, cap, used, error, rows }) {
  const spent = used ?? [...paragraphs.join("\n\n")].length;
  const over = cap != null && spent > cap;
  const sized = rows != null;
  return (
    <div style={sized ? { flex: "none", display: "flex", flexDirection: "column", gap: "var(--space-1)" } : { flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-1)", minHeight: 0 }}>
      <div
        style={{
          flex: sized ? "none" : 1,
          minHeight: sized ? `calc(${rows} * var(--text-body-large--line-height) + 26px)` : undefined,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 12,
          borderRadius: "var(--radius-extra-small)",
          border: over ? "1px solid var(--error)" : "1px solid var(--border-field)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {paragraphs.map((text, index) => (
          <p
            key={text}
            style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)", letterSpacing: "var(--text-body-large--letter-spacing)" }}
          >
            {text}
            {index === paragraphs.length - 1 && <Caret />}
          </p>
        ))}
      </div>
      <FieldSupport error={error} cap={cap} used={spent} />
    </div>
  );
}

/* THE WORDS PATH'S FIRST STAGE, whole — `ComposeWords` itself, and the same
   stage drawn against its cap (`ComposeWordsCaps`). One markup for both, the
   `ReplyDraft` reason again: the stage is not a different stage because the
   body has grown long, and two copies of it would drift about the prompt, the
   escape and the foot.

   `used` IS THE WHOLE BODY, THE PARAGRAPHS ARE WHAT IS ON SCREEN. A body near
   five thousand characters does not fit the box it is written in — a writer
   that far in sees the last few lines and nothing above them — so the caps
   board draws the tail and states the length. */
const WORDS_STAGE_BODY = [
  "Three weekends of walking the same stretch at low tide, tracing where the salt crust draws its lines.",
  "The rubbings pick up what the light misses. Paper against the crust, the side of a wax stick, and whatever the wind allows — none of them took longer than the walk out to make.",
  "If you ever drive it, stop at the third headland and look down for once.",
];

function ComposeWordsBody({ paragraphs = WORDS_STAGE_BODY, used, error, nextDisabled = false }) {
  return (
    <>
      <WizardHeader title="New post" />
      <PickPrompt caption="The body is your words." escapeLabel="Add pictures instead" />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: "8px 24px 24px", overflow: "hidden" }}>
        <FieldLabel>What do you want to publish?</FieldLabel>
        <WordsBody cap={5000} paragraphs={paragraphs} used={used} error={error} />
        <Button style={{ width: "100%", marginTop: 12 }} disabled={nextDisabled}>Next</Button>
      </div>
    </>
  );
}

/* THE PICTURE PATH'S DETAILS STAGE, whole — `ComposeDetails` itself, and what
   the reference pair sheet stands on. Factored for `ReplySealBody`'s reason: a
   sheet covers the surface the reader came from, and that surface has to be the
   real one, so the two boards share one markup.

   THE TWO CAPPED FIELDS TAKE THEIR CONTENT FROM THE BOARD (the caps-affordance
   round), so the stage near its caps is this stage and not a copy of it. The
   defaults are the canonical fixtures; `ComposeDetailsCaps` passes longer ones
   and the refusal that belongs to the surface, and `nextDisabled` is what a
   field over its cap does to the step. Nothing else about the stage moves.

   `words` IS THE SAME STAGE ON THE WORDS PATH (jakob 2026-10-02, curate 2):
   no media row, no describe row and no Description — a words post carries
   no description — and everything else as it stands here
   (`ComposeDetailsWords`). */
function ComposeDetailsBody({
  title = "Salt maps of the coast road",
  titleError,
  description = "Rubbings from three weekends at low tide — paper against the salt crust.",
  descriptionError,
  nextDisabled = false,
  words = false,
}) {
  /* The element names are `ComposeDetails`'s calibration IDs (seam 002). They
     reach a built board only where the screen is registered (`NODE`); every
     other board this body stands on renders them stripped. */
  return (
    <>
      <WizardHeader title="Details" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        {!words && (
          <>
            <PickedRow
              items={[{ src: "post-photo.jpg" }, { src: "inviter.jpg" }]}
              caption="2 pictures — the body"
              onManage={() => {}}
              node="mediaRow"
            />
            <DescribeCounter described={0} total={2} onDescribe={() => {}} node="describeRow" />
          </>
        )}

        <TextField label="Title" corner="Optional" cap={100} value={title} error={titleError} node="title" />

        {!words && <TextField label="Description" corner="Optional" rows={3} cap={500} value={description} error={descriptionError} node="description" />}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="tags">
          <FieldLabel node="label">Tags</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TopicRemovable topic="fieldnotes" onEdit={() => {}} node="tag" />
            <TopicRemovable topic="coastroad" onEdit={() => {}} node="tag" />
          </div>
          <InlineAction size="sm" selfStart node="add">
            + Add a tag
          </InlineAction>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-node="references">
          <FieldLabel node="label">References</FieldLabel>
          <StagedReference
            kind="post"
            name="The long way home — @ada"
            sub="Post"
            src="post-photo.jpg"
            pair={{ pDirected: 0.1, pInterest: 0.1 }}
            onEdit={() => {}}
            node="stagedReference"
            nodeKey="1"
          />
          <InlineAction size="sm" selfStart node="add">
            + Cite something
          </InlineAction>
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }} disabled={nextDisabled} node="next">
          Next
        </Button>
      </div>
    </>
  );
}

/* THE POST EDIT, whole — `EditCompose` itself, and what its acts sheet, its
   tag pair sheet and its picture manager stand on.

   THE BODY IS ALTERABLE (jakob's ruling, 2026-09-10). An edit carries the
   post's complete new content state, so the gallery is not a readout of what
   was published: the row opens the manager over THIS surface (`EditPicked`)
   and the add control takes more pictures, in the same words the composer
   and the comment edit use — the count of what is held, against the cap.

   THE LINE UNDER IT IS THE BLESSED ONE (copy-voice, *Editing a media post*),
   and this is the board it was written for: it says why no words field
   stands where the gallery is. It states the body's rule, not a lock — take
   the last picture away in the manager and the words field is what the edit
   becomes (`EditWords`). */
/* `unchanged` IS THE GUARD, AND THE GATE IS THE BATCH (the topic round,
   2026-09-14): an edit signs when its acts batch has something in it, never
   when the bytes happen to differ. A byte comparison would refuse an author who
   typed a word and took it back — and, worse, would accept one whose only
   change was whitespace the record does not carry. The batch already knows: it
   is what the acts sheet lists and what the footer counts, so the guard reads
   the number that was always there. */
/* A STAGED WITHDRAWAL, READ BACK WHERE THE THING STOOD, WITH ITS WAY BACK
   (jakob's ruling, the night batch 2026-10-01 — audit K5.3). A tag taken off a
   post, or a citation removed from it, is a record in the edit's batch, not an
   erasure: the chip or the row leaves its block, and this line stands under the
   block naming what goes. `Undo` unstages that one withdrawal — the chip or the
   row returns as it stood, and the acts card counts its records off again. One
   line per item, so each carries its own `Undo`.

   RE-PICKING A WITHDRAWN NAME IS THE SAME UNDO. Choosing `#coastroad` again in
   the tag picker, or the same post in the reference picker, unstages its
   withdrawal rather than staging a second, cancelling record: one staged act
   per name (behavior/TagPicker.md, behavior/ReferencePicker.md). */
function WithdrawnLine({ name }) {
  return (
    <QuietNote>
      Withdrawn: {name}{" "}
      <InlineAction size="sm" ariaLabel={`Undo withdrawing ${name}`}>
        Undo
      </InlineAction>
    </QuietNote>
  );
}

/* What the post edit's References block holds withdrawn — another author's
   post the edit stops citing. Its removal stages `withdrawalCost` counter-records,
   and this one was revised upward past 1, so it stages two. */
const EDIT_WITHDRAWN_CITATION = `${REPLY_CITATION} — @juno`;

function EditComposeBody({ unchanged = false } = {}) {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — your draft is kept" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        {/* The fields scroll under the pinned foot, the wizard reading: a
            form taller than the phone runs on under it, and the foot stays
            whole. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <PickedRow
              items={[{ src: "post-photo.jpg" }, { src: "inviter.jpg" }]}
              caption="2 pictures — the body"
              onManage={() => {}}
            />
            <InlineAction size="sm" selfStart>+ Add pictures · 2 of 10</InlineAction>
            <QuietNote>A post&apos;s body is words or media, never both.</QuietNote>
          </div>

          <TextField label="Title" corner="Optional" cap={100} value="Salt maps of the coast road" />

          <TextField
            label="Description"
            corner="Optional"
            rows={2}
            cap={500}
            value="Rubbings from three weekends at low tide — paper against the salt crust."
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>Tags</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <TopicRemovable topic="fieldnotes" onEdit={() => {}} />
              <TopicRemovable topic="saltmaps" onEdit={() => {}} />
            </div>
            <InlineAction size="sm" selfStart>+ Add a tag</InlineAction>
            {!unchanged && <WithdrawnLine name="#coastroad" />}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>References</FieldLabel>
            {/* The composer's whole staged form, as `ComposeDetails` draws it:
                the kind under the name, and the pair the citation signs. An edit
                stages the same citation a first draft does, so it shows back the
                same facts. The row opens `RefPairEdit` — the citation already
                stands, so its pick adds a record — and its × withdraws it. */}
            <StagedReference
              kind="post"
              name="The long way home — @ada"
              sub="Post"
              src="post-photo.jpg"
              pair={{ pDirected: 0.1, pInterest: 0.1 }}
              onEdit={() => {}}
            />
            <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
            {!unchanged && <WithdrawnLine name={EDIT_WITHDRAWN_CITATION} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <FactRow
              label="License"
              value="Public domain"
              action={
                <span style={{ color: "var(--text-secondary)", display: "inline-flex" }} aria-label="The license never changes">
                  <Icon name="lock" size={16} />
                </span>
              }
            />
            <FactRow label="Sensitive" value="Not marked" action="Mark" last />
          </div>
        </div>

        {/* Five things: the edit, #saltmaps added, #coastroad withdrawn, and the
            citation's withdrawal at its two counter-records (`EditActs`). */}
        <ActsFooter count={unchanged ? 0 : 5} />
        <Button style={{ width: "100%" }} disabled={unchanged}>Sign the edit</Button>
      </div>
    </>
  );
}

/* The comment sheet's composer foot: your face, and the field-shaped door
   that opens a comment. Every sheet of comments carries it, so it is
   written once.

   THE FOOT IS A DOOR, NOT AN EDITOR (the comments-sheet round, readme §13;
   held against the growth law in the foot ruling, 2026-09-22). The tap
   lands in the full-focus composer — draft, media, and the signing ceremony
   live there, and a lighter comment path split off from that ceremony is a
   product the tree does not draw. Nothing is ever typed here, so the growth
   law does not reach this field: it is drawn at its single line and stays
   there. Whether the foot ever goes live is the chats round's question — a
   chat is an inline signed send, and this foot inherits whatever that round
   designs.

   AN APPLICANT'S FOOT IS LOCKED, NOT GONE (jakob 2026-10-02; auth.md's locked
   look): the door stands visibly inactive at the disabled opacity and stays
   tappable, the tap answering `You can comment once you're in.` `fieldOpacity`
   carries it — `ReplyEntry`'s reader chip passes the applicant's reading. */
function CommentComposerFoot({ fieldOpacity }) {
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 0", borderTop: "1px solid var(--border-hairline)" }}>
      <MonogramAvatar name="Sol Ferreira" />
      <div style={{ flex: 1, opacity: fieldOpacity }}>
        <TextField label="Add a comment" rows={1} cap={2000} value="" />
      </div>
    </div>
  );
}

/* The comments sheet itself — the sheet, its title, the list the comments
   stand in, and the composer at its foot. It is BOARD GLUE, not a master: the
   readme's rule is that a shape reused across PRODUCTS becomes a component,
   and this one is reused across BOARDS of one surface. Every board that opens
   comments draws the same frame and differs only in the cards inside it, so
   the cards are the children and the frame is written once. */
/* THE SHEET TAKES THE TALLEST CLASS — `tallest`, the 72px sliver below the safe
   area, which is the ceiling every sheet is held under and this one is pinned at.
   A thread is the one surface with a list to read and a field to write in at
   once, so the surface owns the height and the list scrolls inside it; the
   composer's own growth comes out of that list (`CommentComposerFoot`). */
/* `scrolledBy` DRAWS A SHEET THE READER HAD ALREADY MOVED (the reply-return
   ruling, readme §13): the list carries a zero-height first item with a
   negative top margin, so every comment after it rides up by that much and the
   list's own `overflow: hidden` cuts what leaves at the top. The list's gap
   sits between that item and the first comment, so the margin carries it too —
   the number a board passes is the pixels of scroll, not the pixels of
   margin. */
const COMMENTS_GAP = 12;

function CommentsSheet({ children, scrolledBy = 0, footOpacity }) {
  return (
    <BottomSheet open tallest ariaLabel="Comments">
      <SheetTitle>Comments</SheetTitle>
      <ul style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: COMMENTS_GAP, margin: 0, padding: "0 16px", listStyle: "none" }}>
        {scrolledBy > 0 && <li aria-hidden="true" style={{ flex: "none", height: 0, marginTop: -(scrolledBy + COMMENTS_GAP) }} />}
        {children}
      </ul>
      <CommentComposerFoot fieldOpacity={footOpacity} />
    </BottomSheet>
  );
}

/* What @tobias's two collapsed replies are, once a landing expands them. They
   live beside the thread rather than inside the collapsed board, because the
   collapsed board counts them and never draws them — and a count drawn beside
   a list it disagreed with is the defect this canvas keeps closing. */
const TOBIAS_REPLIES = [
  {
    id: "t1",
    author: ADA,
    content: "The glovebox is the whole trick. Mine lives in the door pocket.",
    timestamp: "35m",
    onReply: () => {},
    license: { attribution: 0, provenance: 0 },
    menuItems: CARD_MENU,
  },
  {
    id: "t2",
    author: MIRA,
    content: "@tobias It is the bend that does it, not the light. Prove me wrong.",
    timestamp: "28m",
    onReply: () => {},
    license: { attribution: 0, provenance: 0 },
    menuItems: CARD_MENU,
  },
];

/* `landed` is the state a signed reply returns into (readme §13, the
   reply-return ruling): the parent's collapsed count has become its replies,
   and the reply just signed sits in `CommentCard`'s reserved `children` slot —
   the slot the composer stood in, which is why the words land where the reader
   left them.

   THE THREAD'S ORDER IS THE RULE'S (readme §13, *Comments live in a sheet*):
   top-level comments newest first — @tobias 1h, @mira 2h, @sol 3h — and the
   replies in a branch oldest first. The landed reply is the one place this
   sheet does not follow it yet: by the rule it ends its branch, and moving it
   there puts its words below the frame at the kept offset — which way the
   landing brings it into view is still to be ruled, so the drawing waits. */
/* `removed` DRAWS THE READER'S OWN COMMENT AFTER THEIR REMOVE (the
   comment-removal round, 2026-10-01). @sol's comment is the reader's — the
   foot's monogram says who is reading — and it is the one with a branch under
   it, which is the point: removal takes the payload, never the record
   (comment.md §5), so the card keeps its author, its time and its place in the
   order, and `RedactedContent` stands where the words were. The replies keep
   their parent and stay readable — removal never breaks a thread.

   ITS SECOND LINE SWAPS THE NOUN. The author's mark ships the post's words —
   "The post's place in the thread" — and a comment says its own, the way a
   chat message carries its own second line.

   A REMOVED COMMENT HAS NO MENU LEFT, the post's `Removed` rule: nothing on
   its card is left to save, cite or read the terms of, so its ⋮ goes with the
   payload. What survives is what survives a removed post — the author, the
   opinion a reader can still give, and the way to answer. */
const REMOVED_COMMENT_NOTE = "The comment's place in the thread, and every response, remain.";
/* WHERE THE READER STANDS IN THE THREAD for the whole removal — the menu, the
   dialog and the mark (`ReplySettled`'s `scrolledBy`, the reply-return
   ruling's offset). @sol's comment stands third, below the fold of a sheet
   drawn from its top, so the three boards keep the reader where they were when
   they opened their comment's ⋮: the comment and its branch in view, the
   thread above it cut at the sheet's top edge. One number, so the three cannot
   disagree about where that is. */
const REMOVED_COMMENT_SCROLL = 440;
/* @SOL'S COMMENTS ARE THE READER'S, AND THEY SAY SO (jakob 2026-10-01: "'own'
   should be added to the existing boards so it is clear that you can interact
   differently with your own comments"). The 3h comment and the landed reply
   wear `CommentCard`'s `own` — `Edit` beside `Reply` in the affordance row,
   the anatomy `ReplyMedia` drew first — and their ⋮ holds the own menu's acts
   (`OWN_COMMENT_MENU`'s `Remove` after Save and Cite; the card appends the
   license). The removed comment keeps `own` but loses `Edit` with its payload:
   there is nothing left on it to edit, the same reason its ⋮ goes. */
const OWN_THREAD_MENU = [...CARD_MENU, REMOVE_ROW];

/* `replyOpacity` LOCKS EVERY `Reply` IN THE THREAD for an applicant reader
   (jakob 2026-10-02), the foot's `footOpacity` twin: `CommentCard` carries it
   down to the replies, so one value locks the whole thread's Reply buttons. */
function CommentsThreadSheet({ landed = false, scrolledBy = 0, removed = false, footOpacity, replyOpacity }) {
  const settledReply = (
    <ul style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", margin: 0, padding: 0 }}>
      <CommentCard
        depth={1}
        pending
        author={SOL}
        content="The third headland light is real — I have a print from 2019 that almost catches it. Almost."
        timestamp="now"
        own
        onEdit={() => {}}
        onReply={() => {}}
        replyOpacity={replyOpacity}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={OWN_THREAD_MENU}
      />
    </ul>
  );
  return (
    <CommentsSheet scrolledBy={scrolledBy} footOpacity={footOpacity}>
      <CommentCard
        author={TOBIAS}
        content={TOBIAS_COMMENT}
        timestamp="1h"
        bundle={mkBundle(0.1, 0.1)}
        onReply={() => {}}
        replyOpacity={replyOpacity}
        replyCount={2}
        onOpenReplies={landed ? undefined : () => {}}
        replies={landed ? TOBIAS_REPLIES : []}
        topics={["glovebox", "coastroad"]}
        references={1}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={CARD_MENU}
      >
        {landed ? settledReply : null}
      </CommentCard>
      {/* The veiled comment sits SECOND, where the frame still shows it
          whole: the thread is taller than the sheet, and a state drawn
          below the fold is a state nobody can check. The whole body — the
          words and the two pictures with them — is under one
          comment-scale block, while the author, the timestamp and the
          opinion stay readable. */}
      <CommentCard
        author={MIRA}
        content="The gulls had been at it before the tide came back. Two frames, both grim."
        timestamp="2h"
        media={[
          { src: "comment-shingle.jpg", ratio: "4 / 3", fit: "cover", alt: "A stretch of shingle at low tide." },
          { src: "comment-gulls.jpg", ratio: "1 / 1", fit: "cover", alt: "Gulls on the tideline." },
        ]}
        sensitive={{ reason: "A dead seabird in the second frame." }}
        onReply={() => {}}
        replyOpacity={replyOpacity}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={CARD_MENU}
      />
      <CommentCard
        author={SOL}
        content="Which headland is the third one, counting from the ferry landing?"
        timestamp="3h"
        own
        onEdit={removed ? undefined : () => {}}
        onReply={() => {}}
        replyOpacity={replyOpacity}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={removed ? [] : OWN_THREAD_MENU}
        redacted={removed ? { reason: "author", when: "now", note: REMOVED_COMMENT_NOTE } : undefined}
        replies={[
          {
            id: "r1",
            author: ADA,
            content: "The one past the pines — the road dips right before it.",
            timestamp: "40m",
            onReply: () => {},
            license: { attribution: 0, provenance: 0 },
            menuItems: CARD_MENU,
          },
          {
            id: "r2",
            author: TOBIAS,
            content: "@ada That dip floods at spring tide, mind the sign.",
            timestamp: "22m",
            onReply: () => {},
            license: { attribution: 0, provenance: 0 },
            menuItems: CARD_MENU,
          },
        ]}
      />
    </CommentsSheet>
  );
}

/* ── The stream's fixtures (readme §13, the reel round) ───────────────────
   The clip and the post it belongs to. Everything the stream is BUILT from is a
   master — `ReelRail`, `ReelCaption`, `SeekLine`, `MediaDisc`, `PinnedClip` —
   because the stream is the ordinary feed in a different frame, not a second
   product; what stays here is the mock material those masters are handed. */

const CLIP_LAKESIDE = {
  kind: "video",
  src: "clip-lakeside.mp4",
  poster: "clip-lakeside.jpg",
  ratio: "portrait",
  alt: "A man standing at the edge of a lake as the light drops.",
};

const MIRA_CLIP_POST = {
  author: MIRA,
  title: "The lake, doing nothing, for forty seconds",
  description:
    "Stood there long enough that the midges found me. Worth it for the last ten seconds, when the far shore goes the colour of the water.",
  timestamp: "35m",
  media: [CLIP_LAKESIDE],
  topics: ["stillwater", "coastroad"],
  score: "7.40",
  comments: 2,
  opinions: 6,
  license: { attribution: 0, provenance: 0 },
  menuItems: CARD_MENU,
};

/* ── The other two clip shapes (video-cover round, 2026-09-10) ─────────────
   A clip keeps its own shape, clamped to tall, so three shapes reach a card
   three ways and all three are drawn on `FeedShapes`. The wide one is the
   cover-at-rest board's clip, shared rather than spelled twice; the square one
   stands on a downsampled square from the photo corpus (assets/photos/README).

   BOTH CARRY A COVER, and the vertical one does not: a horizontal or square
   clip meets the frame picker, a vertical clip's default is no cover and its
   face is the first frame. The fixtures say that by what they hold.

   The wide clip is also the rotated viewer's — it was spelled twice before a
   third screen wanted it, which is exactly when a screen-local fixture stops
   being one. */

const CLIP_CANOE = {
  kind: "video",
  src: "clip-canoe.mp4",
  /* post-photo.jpg doubles as this clip's poster — it is the same frame of
     the same lake crossing, at the same 16:9 (backlog 62). */
  poster: "post-photo.jpg",
  ratio: "landscape",
  alt: "Two canoes crossing a mountain lake.",
};

const CLIP_GRAPES = {
  kind: "video",
  src: "clip-grapes.mp4",
  /* gallery-grapes.jpg doubles as this clip's poster: the published
     canvas editor holds at most 200 files and the tree sits at that
     ceiling, so no image may serve a single board (backlog 62). */
  poster: "gallery-grapes.jpg",
  ratio: "square",
  alt: "Two hands turning a bunch of grapes in the light.",
};

const TOBIAS_CANOE_POST = {
  author: TOBIAS,
  title: "Crossing at the narrows before the wind got up",
  description:
    "Four of us out, one camera wedged in the bow. The far bank is closer than it looks from the road.",
  timestamp: "2h",
  media: [{ ...CLIP_CANOE, resting: true }],
  topics: ["stillwater"],
  score: "4.80",
  comments: 1,
  license: { attribution: 0, provenance: 0 },
  menuItems: CARD_MENU,
};

const ADA_GRAPES_POST = {
  author: ADA,
  title: "Nine seconds of the last of the crop",
  timestamp: "5h",
  media: [{ ...CLIP_GRAPES, resting: true }],
  topics: ["tidemarket"],
  score: "3.60",
  comments: 4,
  license: { attribution: 0, provenance: 0 },
  menuItems: CARD_MENU,
};

/* The bottom bar's height — what the stream's own chrome has to clear. */
const BAND_HEIGHT = 64;

/* ── The license sheet's axis rows (the seal's, and the account default's) ──
   The chooser master draws the two axes as a wrapped row of native radios — a
   form control for a settings page — where a sheet is a decision surface: one
   axis per section, one reading per row, the consequence under the words it
   qualifies. Two boards now ask the same question of one reader, so the rows
   are written once and neither can say a shorter version of the other.

   THE ROW IS THE CONTROL, the way `Checkbox` makes it one: a real radio input,
   visually hidden, with the drawn dot and the words inside the label that names
   it. The dot is `SettingsRow`'s, to the pixel — a license axis and a settings
   choice are the same question asked twice.

   THE CONSEQUENCE SITS UNDER ITS READING, as supporting text — `SettingsRow`'s
   own label-over-status stack, at the same 2px. Every row is then the same
   shape and begins at the same left edge whatever its sentence costs: the
   reading names the choice, the line beneath says what it obliges, and a long
   consequence wraps across the sheet's full measure rather than into a narrow
   trailing column. The rows sit 6px apart — three times the 2px inside a row,
   so a reading and its consequence read as one block and the next choice
   reads as the next one.

   THE DOT KEEPS THE READING'S FIRST LINE: 1px is half of what the 20px reading
   line has over an 18px dot, so the dot centres on the words that name the
   choice and a two-line consequence grows the row downward beneath it. */
function LicenseAxisLabel({ children }) {
  return (
    <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

function LicenseAxis({ axis, name, tiers, chosen }) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tiers.map((tier, index) => (
        /* The ROW carries the flow number, not the input inside it: a visually
           hidden radio cannot show a badge, and the row is what a reader
           presses. */
        <label key={tier.label} data-axis={axis} className="cg-state cg-focus" style={{ display: "flex", alignItems: "flex-start", gap: 10, minHeight: 24, position: "relative", cursor: "pointer", borderRadius: "var(--radius-small)" }}>
          <input
            type="radio"
            name={name}
            defaultChecked={index === chosen}
            style={{ position: "absolute", opacity: 0, width: "1px", height: "1px", margin: 0 }}
          />
          {/* 1px is half of what the 20px reading line has over an 18px dot: the
              dot centres on the reading, not on the row. */}
          <span
            aria-hidden="true"
            style={{
              width: 18,
              height: 18,
              flex: "none",
              marginTop: 1,
              boxSizing: "border-box",
              borderRadius: "var(--radius-full)",
              border: index === chosen ? "5px solid var(--primary)" : "1px solid var(--border-field)",
            }}
          />
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)" }}>
              {tier.label}
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              {tier.hint}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

/* ── The settings page's body ──────────────────────────────────────────────
   What `Settings` draws, and what the two sheets it opens are drawn over. The
   ruling the round records is an ORDER, and a sheet board that redrew a few of
   its rows by hand would be a second order nobody ratified — so the page lives
   here once, and a sheet board shows the top of it under the wash exactly as a
   reader would.

   `Settings` frames the whole scroll; a sheet board keeps the phone's 844 and
   lets the page run past it, which is what a scrolling page under a sheet does.
   The three boards therefore differ in what covers the page and in nothing
   else.

   Two states of the account reach it (the key-loss round): `backup="none"`
   is a reader who declined the backup — the Recovery code row reads
   `Not made yet` and opens `SettingsBackupNone`, and the group's footnote
   stops promising a way back that does not exist — and `forget` is the
   don't-remember switch turned on. Both default to the page every other
   board draws.

   `keptPicks` is the count of picks still waiting after their review was
   left unsigned (backlog item 113, jakob's ruling B3): a quiet row in the
   Key backup group, after `Your key`, reading `3 kept picks waiting`, that
   reopens `KeptPicksReview`. It exists only while that is true — the key
   here and unsigned kept picks waiting; with the key gone again, the
   waiting-for-key state owns the surface — so it defaults to none, and
   `Settings`, which draws the page whole, draws it present to show its
   place in the order. */
/* THE SUPPORT STACK'S FIXTURES (jakob, 2026-10-01). Spelled once because the
   settings row, the release chronicle and the report's diagnostic line all
   read the running version, and three boards disagreeing about it would be
   the drift the constant exists to stop. The repo states 0.1.0; the boards
   draw two patch releases later so the chronicle has a history to show.
   Both addresses are placeholders until CoGra is on a server, on `.local`,
   the repo's own genesis-account domain: real-shaped, and undeliverable, so
   nothing sent before the swap reaches a stranger.

   THE STORE LISTING IS A PLACEHOLDER THE SAME WAY (jakob 2026-10-02, F2).
   `Update now` opens CoGra's Play Store listing, which does not exist until
   the app is published; until then the id is the `.local` domain's own
   reverse name — real-shaped, and no stranger's listing can hold it. It swaps
   for the real listing when CoGra is published (backlog item 118).

   THE RELEASES' PUBLIC PAGES ARE THE CHRONICLE'S DEEPER LEVEL (jakob
   2026-10-02, the fix-fix round's ruling 0). Each release card's door opens
   `RELEASES_URL` + `/tag/v<version>` — that release's full notes and its
   code. Only the cards lead there; `Update now` leads to the download. */
const RUNNING_VERSION = "0.1.2";
const REPORT_ADDRESS = "reports@cogra.local";
const CONTACT_ADDRESS = "hello@cogra.local";
const STORE_LISTING_URL = "https://play.google.com/store/apps/details?id=local.cogra.app";
const RELEASES_URL = "https://github.com/helping-kaiser/cogra/releases";

/* THE RELEASE CHRONICLE, whole (`WhatsNew`'s anatomy, shared the moment its
   behind state drew it a second time). The notes are fixture, not copy. */
const RELEASES = [
  {
    version: RUNNING_VERSION,
    date: "30.09.2026",
    installed: true,
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

/* A newer release than the one running here (jakob 2026-10-01, the A10
   ruling) — the behind state's fixture, one patch on, drawn atop the
   chronicle as the newest. Its notes are fixture like the rest. */
const NEWER_RELEASE = {
  version: "0.1.3",
  date: "02.10.2026",
  newest: true,
  notes: ["The filter's Reset brings back your own default."],
};

/* The behind state's two lines — drafts flagged for blessing (copy-voice,
   *The settings page*, About): the quiet line atop the chronicle, and the
   once-per-release snackbar on a cold open's feed. Both carry `Update now`
   (jakob 2026-10-02): the reader wants the new version, not its code, so
   the door leads to the download — the store listing in the app, and on the
   web a reload into the new version. One string for both. */
const NEWER_VERSION_LINE = "A newer version exists.";
const NEWER_VERSION_SNACKBAR = "A newer version of CoGra is out.";
const UPDATE_NOW = "Update now";

/* THE DATELINE'S WORD NAMES WHAT A VERSION IS TO THIS DEVICE (jakob
   2026-10-02, curate 1): the one running here is `installed`, and a release
   past it is `newest` — never `current`, which a stale running version is
   not. The rest carry no word.

   EVERY CARD ENDS IN ITS RELEASE'S DOOR, `See it on GitHub` (ruling 0): the
   cards are the patch notes, and the door is the only way to the deeper
   level — `RELEASES_URL` + `/tag/v<version>`. The doors are named for their
   release, because controls reading the same words a thumb apart tell a
   listener the verb and not the object (copy-voice, *The settings page*,
   `Copy the PEM block`'s rule). */
function Release({ version, date, installed = false, newest = false, notes }) {
  const word = installed ? " · installed" : newest ? " · newest" : "";
  return (
    <>
      <SectionLabel>{`Version ${version}${word} · ${date}`}</SectionLabel>
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

/* `newer` is the release a running app is behind, or nothing. Given, one
   quiet line stands atop the chronicle — the fact in `--text-secondary`,
   `Update now` ending it, `ProfileMoreFailed`'s line shape — and the newer
   release heads the list as the newest; nothing else changes: no badge, no
   banner, no nagging. `Update now` opens the store listing
   (`STORE_LISTING_URL`) in the app; on the web it reloads the page into the
   new version. Its spoken name says which version it brings. */
function WhatsNewBody({ newer }) {
  return (
    <>
      <PageHeader title="What's new" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 0 16px" }}>
        {newer && (
          <p
            style={{
              margin: 0,
              padding: "8px 24px 0",
              fontSize: "var(--text-body-medium)",
              lineHeight: "var(--text-body-medium--line-height)",
              letterSpacing: "var(--text-body-medium--letter-spacing)",
              color: "var(--text-secondary)",
            }}
          >
            {NEWER_VERSION_LINE} <span aria-hidden="true">—</span>{" "}
            <InlineAction size="sm" ariaLabel={`Update to version ${newer.version}`} onClick={() => {}}>
              {UPDATE_NOW}
            </InlineAction>
          </p>
        )}
        {(newer ? [newer, ...RELEASES] : RELEASES).map((release) => (
          <Release key={release.version} {...release} />
        ))}
        <div style={{ padding: "16px 24px 0" }}>
          <QuietNote>Newest first.</QuietNote>
        </div>
      </div>
    </>
  );
}

/* THE REPORT PAGE, whole (`ReportProblem`'s anatomy, shared the moment its
   empty state drew it a second time). `words` is what the field holds. Empty,
   `Send by email` stays where it is, visible and disabled, with the reason in
   the foot's line right above it — the disabled-submit law (readme §4,
   *Interaction states*; jakob 2026-10-01): never hidden, never live only to
   refuse. `Nothing to send yet` is the edit foot's zero (`Nothing to sign
   yet`) with the report's verb, in `ActsFooter`'s ink. */
function ReportProblemBody({ words }) {
  const empty = !words;
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Report a problem
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          Say what happened, in your own words. Sending opens your email with everything below filled in — nothing goes
          until you send it there.
        </p>

        <div style={{ marginTop: 24 }}>
          <TextField id="report-what-happened" label="What happened" rows={4} value={words ?? ""} />
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column" }}>
          <FactRow label="To" value={REPORT_ADDRESS} />
          <FactRow label="Version" value={RUNNING_VERSION} />
          <FactRow label="Running on" value="Firefox on Ubuntu" />
          <FactRow label="Time" value="01.10.2026, 14:32" last />
        </div>

        <div style={{ marginTop: 12 }}>
          <QuietNote>
            That's all that goes with your words — no account, no key, nothing you've posted. It's sent from your own email,
            so we can write back.
          </QuietNote>
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          {empty && (
            <span
              style={{
                textAlign: "center",
                fontSize: "var(--text-label-small)",
                lineHeight: "var(--text-label-small--line-height)",
                letterSpacing: "var(--text-label-small--letter-spacing)",
                color: "var(--text-secondary)",
              }}
            >
              Nothing to send yet
            </span>
          )}
          <Button style={{ width: "100%" }} disabled={empty}>
            Send by email
          </Button>
        </div>
      </div>
    </>
  );
}

/* `emailPending` and `deleting` are the two in-flight account acts the page
   reads back (jakob 2026-10-01, audit K3.21 and K3.22): an email change with
   a side still owed, and a confirmed deletion in its grace. Each changes one
   row's status, and the deletion also brings its band, which rides every
   logged-in surface and sits under an inner page's header. */
function SettingsBody({ backup = "made", forget = false, keptPicks = 0, emailPending = false, deleting = false } = {}) {
  return (
    <>
      <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
      {deleting && <DeletionBand days={6} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "24px 24px 32px" }}>
        <SettingsGroup
          bare
          label="Theme"
          footnote="Auto follows your device's own setting, and the choice stays on this device."
        >
          <div>
            <SegmentedFilter
              block
              ariaLabel="Theme"
              value="auto"
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "auto", label: "Auto" },
              ]}
            />
          </div>
        </SettingsGroup>

        <SettingsGroup
          label="Giving an opinion"
          footnote="A tap opens this, everywhere. Press and hold instead, and a small positive one is signed on the spot."
        >
          <SettingsRow
            name="settings-stance-input"
            selected
            label="The pad"
            status="A tap opens it; drift to where it feels right."
          />
          <SettingsRow
            name="settings-stance-input"
            selected={false}
            label="Sliders"
            status="One slider per side of the opinion."
          />
          <SettingsRow
            name="settings-stance-input"
            selected={false}
            label="Typed values"
            status="Type both numbers exactly."
          />
        </SettingsGroup>

        <SettingsGroup
          label="Writing"
          footnote="Every signed action is paid for separately. A post's license is settled when it is first signed and never changes."
        >
          <SettingsRow
            checked
            label="Confirm multi-action submits"
            status="Ask first when one submit signs more than one action."
            onOpen={() => {}}
          />
          <SettingsRow label="Default license" value="Public domain" onOpen={() => {}} />
        </SettingsGroup>

        {/* THE EXACT VALUES ARE A READING SETTING, and a client-local one —
            like the theme, never an L2 preference (jakob's ruling, backlog item
            53). Off is the drawn state because glyph-first is the product's
            default: the faces and the tag objects carry every PAIR until a
            reader asks for the digits. Scores and ranks are not pairs and are
            drawn either way. */}
        <SettingsGroup
          label="Reading"
          footnote="Every feed starts from what it shows, and a change made inside a feed lasts until you change it back. Both choices stay on this device."
        >
          <SettingsRow label="What your feed shows" value="Posts" onOpen={() => {}} />
          <SettingsRow
            checked={false}
            label="Show exact values"
            status="The number pairs behind the faces."
            onOpen={() => {}}
          />
        </SettingsGroup>

        {/* HIDING IS A READING SETTING THAT IS NOT THIS DEVICE'S (the private-
            viewer-state round). It sits beside Reading because that is the
            activity it belongs to — a reader who wants their feed quieter looks
            where the feed's own default lives — and in a group of its own
            because the Reading footnote's promise, that both its choices stay
            on this device, is not true of a hidden account: that list follows
            the account everywhere. Its count is bare, the row's label having
            already said what is counted (§3); with nobody hidden the row goes
            inert and reads `None`, since a tap that can only open an empty
            sheet is a tap spent on nothing. */}
        <SettingsGroup
          label="People"
          footnote="Hiding someone clears your own feed of them. Nothing changes for them, and their profile still opens if you go looking."
        >
          <SettingsRow label="Hidden accounts" value="3" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Key backup"
          footnote={
            backup === "none"
              ? "Your key signs everything you publish and lives only in this browser. Until you make a recovery code, it can't be brought back."
              : "Your key signs everything you publish and lives only in this browser. Your recovery code is the only way back."
          }
        >
          <SettingsRow label="Recovery code" status={backup === "none" ? "Not made yet" : "Last created 12.08.2026"} onOpen={() => {}} />
          <SettingsRow label="Your key" onOpen={() => {}} />
          {keptPicks > 0 && (
            <SettingsRow label={`${keptPicks} kept ${keptPicks === 1 ? "pick" : "picks"} waiting`} onOpen={() => {}} />
          )}
        </SettingsGroup>

        <SettingsGroup
          label="Sessions"
          footnote="A device you sign out can stay signed in for up to 15 minutes."
        >
          <SettingsRow label="Firefox on Ubuntu" status="This browser" inert />
          <SettingsRow
            label="Pixel 8"
            status="Last used 2d"
            inert
            trailing={<InlineAction onClick={() => {}}>Revoke</InlineAction>}
          />
          <SettingsRow
            label="Unnamed device"
            status="Last used 12.08.2026"
            inert
            trailing={<InlineAction onClick={() => {}}>Revoke</InlineAction>}
          />
          <SettingsRow action label="Sign out everywhere else" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Credentials"
          footnote="Changing your password signs out every other device."
        >
          <SettingsRow label="Password" status="Changed 21d" onOpen={() => {}} />
          <SettingsRow label="Handle" value="@sol" onOpen={() => {}} />
          <SettingsRow
            label="Email"
            value="sol@solferreira.art"
            status={emailPending ? "Change pending" : undefined}
            onOpen={() => {}}
          />
        </SettingsGroup>

        {/* ABOUT SITS AFTER CREDENTIALS AND BEFORE LEAVING (jakob's ruling, the
            batch-rulings round). The page's order is frequency, not taxonomy,
            and these rows are the least-reached on it — nobody opens settings
            to re-watch an intro. They stand together because they are one kind
            of row: doors onto words about the product, or ways to answer it,
            none of them a setting.

            NO FOOTNOTE. A group's footnote carries the fact a reader needs once
            and never again, and there is none here — every row's label already
            says exactly what it opens.

            PRIVACY AND TERMS ARE ROWS AND NOTHING ELSE. They open static legal
            documents, which are written rather than designed; a board drawing
            one would be a drawing of text nobody in this repo writes.

            THE SUPPORT STACK JOINS IT (jakob, 2026-10-01): `What's new`,
            whose value is the version running here and which opens the
            release chronicle (`WhatsNew`); `Report a problem`, the structured
            report (`ReportProblem`); and `Contact`, a plain mail door kept
            apart so reports stay reports. They sit after About CoGra and
            before the legal pair — the product's own words first, then the
            ways to answer it, then the documents. The two addresses are
            placeholders until CoGra is on a server, the APK path's way:
            real-shaped values on the repo's own `.local` domain, swapped
            when the addresses exist. */}
        <SettingsGroup label="About">
          <SettingsRow label="Watch the intro again" onOpen={() => {}} />
          <SettingsRow label="About CoGra" onOpen={() => {}} />
          <SettingsRow label="What's new" value={RUNNING_VERSION} onOpen={() => {}} />
          <SettingsRow label="Report a problem" onOpen={() => {}} />
          <SettingsRow label="Contact" value={CONTACT_ADDRESS} onOpen={() => {}} />
          <SettingsRow label="Privacy" onOpen={() => {}} />
          <SettingsRow label="Terms" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup ariaLabel="Sign out">
          <SettingsRow
            checked={forget}
            label="Don't remember this account on this device"
            status="Your key and your draft are cleared from this browser when you sign out."
            onOpen={() => {}}
          />
          <SettingsRow action label="Sign out" onOpen={() => {}} />
        </SettingsGroup>

        {/* DELETING THE ACCOUNT IS THE LAST ROW, IN ITS OWN GROUP, QUIET AT REST
            (jakob's ruling, the account-deletion round). The weight of this act
            lives in the flow it opens, not in a red row on a page a reader came
            to for the theme: a row shouting at eight neighbours is a row that
            makes the whole page feel dangerous, and a reader who has decided
            does not need to be argued with.

            IT IS A NAVIGATING ROW, NOT AN ACTION ROW. Sign out happens on the
            press — asking first only when it would take the only copy of an
            unbacked key (`SignOutConfirm`); this opens a surface, and the chevron is the system's one
            promise that it does. That is also why the label is a verb phrase
            where `SettingsRow`'s own note asks for a noun: the row names a task
            rather than a setting, and `Account deletion` would be the page's
            only piece of bureaucratic English. The chevron keeps the promise the
            verb might otherwise break.

            THE FOOTNOTE IS THE GROUP'S ONE DEBT — that nothing happens from the
            tap. It is the fact a reader needs exactly once, which is what a
            footnote is for, and saying it here is what lets the row stay one
            quiet line. */}
        <SettingsGroup
          ariaLabel="Delete account"
          footnote={
            deleting
              ? undefined
              : "Nothing is deleted here. The next screen says what goes and what stays, and the deletion is confirmed by a link we email you."
          }
        >
          <SettingsRow label="Delete account" status={deleting ? "Deletion in 6 days" : undefined} onOpen={() => {}} />
        </SettingsGroup>
      </div>
    </>
  );
}

/* ── Restore's body (readme §13, entry; the key-loss round) ──────────────────
   What `Restore` draws, and what its two refused states draw — one body, so
   the three boards differ in the line the field wears and in nothing else.
   The body copy is the screen's `{{restoreBody}}` hole, which each board's
   own VALS fills from its wording chip. `value` seeds the field for a state
   whose line answers something typed; `error` is the field's M3 error line. */
function RestoreBody({ value = "", error }) {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Restore your key
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          {"{{restoreBody}}"}
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField id="recovery-code" label="Recovery code" mono placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX" value={value} error={error} />
        </div>

        <div style={{ marginTop: 16 }}>
          <Checkbox label="Don't remember this account on this device" />
        </div>

        <div style={{ marginTop: 16 }}>
          <Button style={{ width: "100%" }}>Restore the key</Button>
        </div>

        <p
          style={{
            margin: "24px 0 0",
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          This is the only way to restore your key. If the code is gone too, the key can't be brought back — your sign-in still works.
        </p>
      </div>
    </>
  );
}

/* ── The backup's replace screen (readme §13, the settings round; the
   key-loss round) ─────────────────────────────────────────────────────────
   What `SettingsBackup` draws, and what its wrong-code state and the Android
   no-screen-lock warning are drawn over — one body, so the three boards
   differ in the state they draw and in nothing else.

   `app` draws Android's layout: the phone's own unlock is the proof, so there
   is no field, and no lost-code line either — the line exists because a
   browser whose code is gone cannot re-key. `error` is the field's M3 error
   line, `RestoreError`'s words for the same secret refused. */
function SettingsBackupBody({ app = false, error }) {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          A new recovery code
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          A new code re-encrypts your key and replaces the old backup — recovery always uses the
          newest one. Your current code was made on 12.08.2026.
        </p>

        {!app && (
          <>
            <div style={{ marginTop: 32 }}>
              <TextField
                id="settings-rekey-code"
                label="Current recovery code"
                mono
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
                value=""
                error={error}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <QuietNote>
                Lost it? This browser can&apos;t make a new code without the current one. If the Android app holds your
                key, make the new code there.
              </QuietNote>
            </div>
          </>
        )}

        <div style={{ marginTop: app ? 32 : 16 }}>
          <Button style={{ width: "100%" }}>Create a new recovery code</Button>
        </div>

        <p
          style={{
            margin: "24px 0 0",
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          The new code is shown once and never stored. Have somewhere to write it down before you go
          on — the old code keeps working until the new one is confirmed.
        </p>
      </div>
    </>
  );
}

/* ── THE POST SCORE'S DRILL-DOWN (readme §13, the score-and-opinions round) ──
   Backlog item 13, whole: FeedEntry → RankPath → RankHop → the records behind
   one step, each carrying a small cover of the post it came from.

   ITS FIVE PARTS LIVE HERE, NOT IN `components/` — the item's own instruction,
   and the bundle-exposure law agrees with it. A master is a shape reused across
   PRODUCTS; `_shared.jsx` is the shape reused across BOARDS of one surface
   (`CommentsSheet`'s rule). `ScoreOrigin`, `PathTrace`, `PathSummary`,
   `StepSummary` and `ActionLog` are drawn on five boards of one flow and
   nowhere else in the product, so they are glue. Nothing here formats a
   value the system already formats: every pair goes through `StanceValue`,
   which is where the geek mode's `cg-exact` span and its screen-reader twin
   are assigned, and every row that a master already draws — a step, a
   step's facts — IS that master.

   THE REGISTER IS GRAPH, PATHS, CONNECTIONS — never statistics, never a chart
   (jakob). So: faces and rows, a trace of avatars for a path's shape, ages on
   the ladder, and the reader's word throughout is OPINION. There is no bar, no
   meter, no percentage and no trend anywhere in these five parts, and the one
   place a magnitude appears it appears as the product's own number format.

   THE NUMBERS HERE ARE NOT PAIRS, SO THEY PAINT IN BOTH READING MODES. Geek
   mode governs the two-parameter readings a face stands in for; a score and a
   path's contribution have no glyph that could carry their magnitude, exactly
   as the Feed score itself has none (readme §13, geek mode). The pairs on these
   boards — a step's opinion, a record's own — are `StanceValue`s and follow the
   mode like every other pair in the product.

   NO PER-STEP MAGNITUDE IS DRAWN, and that is a truth claim rather than a gap.
   A path's contribution is not the product of the opinions a reader can see
   along it (feed-ranking.md §3.1, §5.1: the per-step weight is damped and
   tier-bound, and the last step alone decays) — so a surface that put a number
   on every step would invite an arithmetic that does not hold. The path states
   what it adds; the steps state what carries them and when. */

/* The cast this flow adds to the canvas's four — the people at the far end of
   the weaker paths, and the holders on the opinions sheet. They live beside the
   drill-down rather than up with ADA/TOBIAS/SOL/MIRA because these five boards
   and the opinions sheet are everywhere they appear. */
const KEL = { handle: "kel", displayName: "Kel Moreau" };
const WREN = { handle: "wren", displayName: "Wren Aliyev" };
const NADIA = { handle: "nadia", displayName: "Nadia Rask" };
const JUNO = { handle: "juno", displayName: "Juno Baptiste" };

/* THE POST THE DRILL-DOWN IS ABOUT, and the viewer it reached. `ADA_POST` is
   the canvas's canonical post and @sol is its canonical reader (`ProfileOwnBody`
   is Sol's own profile), so the whole flow is one honest question: why did
   @ada's post reach @sol at 15.20? */
const SCORE_VIEWER = SOL;

/* THE PATH SET, and it ADDS UP (feed-ranking.md §6.1: the score is the sum of
   the signed, decayed terms of up to `k` internally disjoint paths, strongest
   first, and `k` is governed at order 4–8). Six paths here, disjoint by person:
   6.80 + 4.20 + 2.60 + 1.10 + 0.50 = 15.20, which is `ADA_POST`'s own score.
   The two weakest ride the "more paths" row rather than being spelled out, so
   the arithmetic still closes on the drawn surface. */
const ADA_FACED = { ...ADA, src: "comment-camera.jpg" };
const MIRA_FACED = { ...MIRA, src: "inviter.jpg" };
const SCORE_PATHS = [
  { through: "@ada", people: [SCORE_VIEWER, ADA_FACED], value: "+6.80" },
  { through: "@tobias", people: [SCORE_VIEWER, TOBIAS], value: "+4.20" },
  { through: "@mira", people: [SCORE_VIEWER, MIRA_FACED], value: "+2.60" },
  { through: "@kel and @wren", people: [SCORE_VIEWER, KEL, WREN], value: "+1.10" },
];
const SCORE_MORE_PATHS = { count: 2, value: "+0.50" };

/* ScoreOrigin — THE THING THE SCORE BELONGS TO, carried on all four levels so
   a reader four taps deep never loses what they are reading about.

   IT IS `QuotedRow`, which is the master for exactly this: the thing a surface
   is about, held above it, contained and inert. Inert is right here for the
   master's own reason — the reader came from that card and the back arrow is
   the way to it, so a second door would be a second answer to one question.

   ONE TOP BLOCK PER KIND, ONE TRACE FOR ALL (jakob 2026-10-01: the score is
   about the paths leading there, not the kind of thing it is). Every ranked
   card opens the same four levels, so only the held thing changes, each in
   the words its own card already uses: a post by its title and author, a
   comment — which has no title — by its author's handle over its first words
   (`QuotedRow`'s rule), a person by their name over their handle, a tag by
   its name beside its `#` tile, whose tile takes the darker tone because the
   quote's own box is the tile's default (`NodeMark`'s `onCard`). Drawn side
   by side on `FeedEntryKinds`.

   THE SCORE AND THE THING ARE ONE ENTITY (jakob 2026-10-01: "make it one
   entity"). The figure hangs on the held thing's top-left as a flag, attached
   the way the tag page hangs its claim on each row (`TaggedRow`): the flag's
   tone over the row's, zero gap, and the row squaring its top-left corner
   under it (`QuotedRow`'s `attach`), so flag and thing read as one folder-tab
   silhouette — the number belongs to this thing, not floating near it.

   IT IS THE GLYPH AND THE SIGNED NUMBER, no label word: `graph` and `+15.20`,
   the drill-down's own register, where every path below it is signed and the
   flag is their sum. Its spoken name stays `Feed score`, in a screen-reader
   span. THE SIGN APPEARS ONLY HERE (jakob: the cards keep plain numbers, "we
   dont need noise"); a negative wears its − everywhere, and a zero none.

   IT IS PLAIN TEXT, NEVER `ExplainableNumber`. That master is the affordance
   and never the explanation; here the reader is standing inside the
   explanation, so a control that opened it again would open nothing. It keeps
   the master's own register — the glyph quiet, the value on-surface at 500 —
   because it is the same figure, read rather than pressed. */
const SCORE_ORIGINS = {
  post: { title: "The long way home — @ada", snippet: "Took the coast road instead of the tunnel. Four hours longer, worth every minute.", name: ADA.displayName, src: "comment-camera.jpg" },
  comment: { title: "@tobias", snippet: TOBIAS_COMMENT, name: TOBIAS.displayName },
  person: { title: MIRA.displayName, snippet: "@" + MIRA.handle, name: MIRA.displayName, src: "inviter.jpg" },
  topic: { title: "#saltmaps", mark: <NodeMark kind="topic" onCard /> },
};
const signedScore = (score) => (/^[−-]/.test(score) || /^0(\.0+)?$/.test(score) ? score : "+" + score);

function ScoreOrigin({ kind = "post", score = "15.20" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 6,
          padding: "2px 10px",
          background: "var(--surface-container-high)",
          borderRadius: "var(--radius-small) var(--radius-small) 0 0",
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          color: "var(--text-secondary)",
        }}
      >
        <Icon name="graph" size={16} />
        <span style={SR_ONLY}>Feed score</span>
        <span style={{ color: "var(--on-surface)", fontWeight: 500 }}>{signedScore(score)}</span>
      </span>
      <QuotedRow attach {...SCORE_ORIGINS[kind]} />
    </div>
  );
}

/* PathTrace — A PATH'S SHAPE, drawn as the thing it is: the people it runs
   through, in order, from you to the post. This is the round's one new drawing
   and the reason it exists: a path is a connection between people, and every
   other way of showing one — a bar, a share of a total, a percentage — turns it
   into a statistic about the post instead of a fact about the reader's own
   network.

   IT ENDS ON THE THING IT REACHED, in that thing's own mark (`NodeMark`,
   the closing batch, jakob 2026-10-01): a post's cover tile, a comment's
   glyph tile, a person's circle, a tag's `#` — the mark `ScoreOrigin` holds
   above it, at the trace's size. People are circles everywhere in this
   system, and every other kind is a tile.

   THE AVATARS ARE `aria-hidden` BY THE MASTER, so the trace carries its own
   screen-reader line — the same discipline every stance readout takes — and
   the line is kind-neutral, ending `then what reached you`, the page title's
   own words, because the mark beside it already says the kind.

   ONE HOP NAMES THE PERSON; MORE HOPS TAKE THE GENERIC FORM (jakob
   2026-10-01). A path through one person is spoken `You, then @ada, then what
   reached you`; a path through two or more is spoken `You, then several
   steps, then what reached you`, because a chain of handles read aloud
   buries the reached thing at its end. The row's `Through @kel and @wren`
   still says who. */
const TRACE_ENDS = {
  post: { kind: "post", src: "post-photo.jpg" },
  comment: { kind: "comment" },
  person: { kind: "person", name: MIRA.displayName, src: "inviter.jpg" },
  topic: { kind: "topic" },
};

function PathTrace({ people, size = 24, kind = "post", onCard = false }) {
  const between = people.length === 2 ? `@${people[1].handle}` : "several steps";
  const spoken = `You, then ${between}, then what reached you`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {people.map((person, index) => (
        <React.Fragment key={person.handle}>
          {index > 0 && (
            <span aria-hidden="true" style={{ width: 14, height: 1, background: "var(--border-hairline)", flex: "none" }} />
          )}
          <MonogramAvatar name={person.displayName} size={size} src={person.src} />
        </React.Fragment>
      ))}
      <span aria-hidden="true" style={{ width: 14, height: 1, background: "var(--border-hairline)", flex: "none" }} />
      <NodeMark {...TRACE_ENDS[kind]} size={size} onCard={onCard} />
      <span style={SR_ONLY}>{spoken}</span>
    </span>
  );
}

/* One path on the list — `ContentRow`'s geometry, with the trace where the disc
   would be. It is not `ContentRow` itself: that master's leading slot holds ONE
   40px disc, and a path is a chain. Everything else about the row is the
   master's — the card ground, the medium corner, the 12px padding, the chevron
   that says this opens another surface. */
function PathRow({ people, through, value, onOpen, kind = "post" }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        border: 0,
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        padding: "var(--space-3)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <PathTrace people={people} kind={kind} onCard />
        <span
          style={{
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Through {through}
        </span>
      </span>
      <span style={{ flex: "none", fontSize: "var(--text-body-small)", fontWeight: 500 }}>{value}</span>
      <span style={{ flex: "none", display: "inline-flex", color: "var(--text-secondary)" }} aria-hidden="true">
        <Icon name="chevron_right" size={18} />
      </span>
    </button>
  );
}

/* PathSummary — what one path does, in the two facts that are true of it:
   what it adds to the score, and how fresh the last opinion on it is. Both are
   `FactRow`s, the product's one fact block.

   TWO ROWS AND NOT THREE. The sign of a path — whether it carries the post
   toward the reader or away (feed-ranking.md §5.2) — is already the sign on the
   figure, and a row repeating it in words would be the same fact twice.

   THE AGE IS THE LAST STEP'S, because only the last step decays (§5.3): silence
   on a relationship is not a partial revocation, so an old path with a fresh
   opinion at its end competes at full weight. That is the sentence this row
   exists to make checkable. */
function PathSummary({ adds, newest }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <FactRow label="What it adds" value={adds} />
      <FactRow label="Newest opinion on it" value={newest} last />
    </div>
  );
}

/* StepSummary — one step's facts. The opinion that carries it goes through
   `StanceValue`, so the face leads and the pair rides the mode; the records
   behind it are a count with the way to them on the row's own action, which is
   `FactRow`'s slot for exactly that. */
function StepSummary({ pair, behind, newest, onOpenRecords }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <FactRow label="What carries it" value={<StanceValue pDirected={pair.pDirected} pInterest={pair.pInterest} />} />
      <FactRow label="Behind it" value={behind} action="Show them" onAction={onOpenRecords} />
      <FactRow label="Newest of them" value={newest} last />
    </div>
  );
}

/* ActionLog — the signed records behind one step, which is the floor of this
   whole surface: below it there is nothing but what the network published.

   THE ROWS ARE INERT (`ContentRow`'s rule: a record with no destination is the
   same row with nothing to press). What a reader would want from one of these
   is its identity, and the row states it rather than hiding it behind a tap.

   THE KEY IS DRAWN IN MONO AND NAMED EXACTLY, the copy rule for a format that
   IS the content: a record nobody can look up is not a record. It is the only
   place on these four boards where the system's own vocabulary reaches the
   screen, and it earns it.

   THE PAIR GOES THROUGH `StanceValue`, whole — face and `cg-exact` digits in one
   master, which is also where the accessible name that speaks the whole fact in
   both reading modes is assigned. It rides the row's second line rather than a
   leading disc: at the card's 334px of content a face, a pair, a name, a key and
   an age do not share one line, and the name is what a reader scans. */
function ActionLog({ records }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {records.map((record) => (
        <div
          key={record.key}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            borderRadius: "var(--radius-medium)",
            background: "var(--surface-card)",
            padding: "var(--space-3)",
            boxSizing: "border-box",
          }}
        >
          <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {record.what}
            </span>
            <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              {record.when}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ flex: "none" }}>
              <StanceValue pDirected={record.pair.pDirected} pInterest={record.pair.pInterest} />
            </span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {record.key}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* The drill-down's column — the read surface's own gutter, matching the
   chronicle's and the post detail's. */
function ScoreColumn({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, padding: "8px 16px 0" }}>
      {children}
    </div>
  );
}

/* ── WHO HOLDS AN OPINION ON THIS (backlog item 55) ────────────────────────
   The profile's "opinions on you", mirrored onto content and UNGATED (jakob):
   everyone can check every post and every comment, the way everyone can read a
   profile's counts.

   THE SHEET IS `RefsSheet`'s PATTERN, which is what jakob's ruling names: a row
   on the detail opens a bottom sheet holding the full set, and the count on the
   row IS the list's length — the sheet is the only place that number can be
   checked, so a count that quietly dropped a holder would tell a reader the
   sheet holds less than it does.

   THE ROWS ARE `StanceRow`, the master the profile's own opinions page uses.
   The order MIRRORS `ProfileStances`: strongest first, by the opinion's own
   for-or-against value. That order is the precedent's, read off the board
   rather than found written down — it is what a reader of the profile page has
   already learned to expect, and a second surface sorting the same rows a
   different way would teach them it means nothing. */
const POST_OPINION_HOLDERS = [
  { name: MIRA.displayName, handle: MIRA.handle, src: "inviter.jpg", pDirected: 0.9, pInterest: 0.25 },
  { name: ADA.displayName, handle: ADA.handle, src: "comment-camera.jpg", pDirected: 0.7, pInterest: 0.4 },
  { name: TOBIAS.displayName, handle: TOBIAS.handle, pDirected: 0.6, pInterest: 0.65 },
  { name: SOL.displayName, handle: SOL.handle, pDirected: 0.55, pInterest: 0.2 },
  { name: KEL.displayName, handle: KEL.handle, pDirected: 0.25, pInterest: 0.95 },
  { name: NADIA.displayName, handle: NADIA.handle, pDirected: 0.15, pInterest: 0.15 },
  { name: WREN.displayName, handle: WREN.handle, pDirected: -0.2, pInterest: 0.1 },
  { name: JUNO.displayName, handle: JUNO.handle, pDirected: -0.55, pInterest: 0.25 },
];


/* ── THE TAG PAGE, WHOLE (the topic round, 2026-09-14) ─────────────────────
   Shared for `ProfileOtherBody`'s reason: the held state is a STATE of this
   page, not a second page, and a body drawn twice would drift. One prop, one
   difference — the bundle the row's anchor reads.

   THE ROW IS THE PAGE'S ONE ACTION, so it wears the profile's one-primary-
   action idiom: `StanceControl` `wide`, stretched to the column, under the
   title and above the list. Item 46.5 is what it closes — the tag round drew
   this gesture on the header's trailing edge and jakob's review removed it,
   because beside the entrance post's context it read as that post's stance
   readout. A row of its own, below the title and above anything belonging to
   a post, cannot be read as any post's anything.

   AND IT NAMES WHAT IT STANCES. `targetLabel` is the tag itself, hash and all
   — the mechanism backlog item 46.1 added for exactly this page, where more
   than one stance control stands. The face's accessible name and the skip-link
   beside it both read it, so the three on the page say which is which.

   THE WORDS ARE THE AFFINITY FAMILY'S, NOT THE STANCE'S. Following a topic IS
   the stance gesture (jakob, 2026-09-14) — one gesture, one ceremony, one face
   table — but the two slots it fills are association and attraction
   (`layer1-interface.md` §9.5), and their ends are not "Against / For". Six
   words, ruled 2026-09-15: each axis's question and its two ends, because a
   slider that says where a track stops still has to say what the track asks.
   The pad itself draws the four ends alone. */
/* THE TOPIC'S WAY OUT IS ITS OWN WORD (jakob 2026-09-15): "nah thats all to
   complicated for users.. instead of walk back we could just call it
   'disconnect' or sth like this. and then we can say 'no opinion towards
   #saltmaps' or sth similar.. we want human wording not this nerdy stuff!"

   `Walk it back` is a sentence about a person — you walk back something you
   said to somebody. A reader who has said they like a topic has not made a
   promise to it, and the word for undoing that is the plain one everybody
   already owns: they disconnect. The readouts follow the same rule — what a
   reader is left with is not a state with a name, it is simply no opinion
   towards the thing, said in those words.

   PERSONS KEEP THEIR FAMILY. jakob objected to the topic's wording and only to
   it, and `Walk it back` is right where there IS a relationship: it stands on
   every profile, post and comment pad exactly as before. */
const AFFINITY_SEVERANCE = {
  control: "Disconnect",
  busy: "Disconnecting…",
  title: (name) => `Disconnect from ${name}?`,
  effect: (name) =>
    `You end up with no opinion towards ${name}. It stops reaching your feed, you stop earning from it, and nothing passes on through you.`,
  sum: (name, total) => `Everything you've said about ${name} adds up to ${total}, and disconnecting clears all of it.`,
  gone: (name) => `No opinion towards ${name}.`,
  zero: "No opinion",
  landing: "This leaves you with no opinion towards it.",
  help: "Disconnect takes everything you've said about the topic to nothing. It has its own confirmation, and each thing you've said is cleared by its own signature.",
  helpAlternates: "Disconnect takes everything to nothing, and each thing you've said is cleared by its own signature.",
};

const AFFINITY_AXES = {
  directed: "How much you like it",
  left: "Dislike",
  right: "Like",
  interest: "How close you want to be",
  bottom: "Far away",
  top: "Close to me",
  severance: AFFINITY_SEVERANCE,
};

/* `stanceOpen`/`stanceDefaultPick` are `PostCard`'s two pass-throughs by
   another name (item 77): whether the topic's pad is bloomed, and where its
   knob is parked, are facts about the BOARD rather than about the page — a
   server-rendered board asks the master for a state a click cannot reach
   instead of copying the pad. No `padInset` rides with them: the inset exists
   to lift the parked card clear of a bottom bar, and this page has none. */
/* THE TOPIC'S OWN STANCE ROW, as one anatomy (the re-review, 2026-09-15). Both
   states of the page carry it now — the populated one and the emptied one — and
   a row drawn twice is a row that can disagree with itself about its padding,
   its width or its axis words. So it is lifted here and the two boards differ
   only in the name they hand it and whether anything is held.

   SHARE CLOSES THE ROW (jakob 2026-10-01: "yes add share to tag page"). The
   page's one wide control is the stance on the topic, the profile's situation
   exactly, and the row takes the profile actions row's geometry: the anchor
   takes what is left, and what the page does besides closes the row. On a
   profile that is the ⋮, because a person has rows to hang off it — mention,
   save, hide. A Type has none of those: no license, never cited, never saved,
   never hidden. A ⋮ here would open a sheet holding one row, so share stands
   as itself, the `ShareButton` glyph every card's row ends with — one tap, the
   platform's own sheet. */
function TopicStanceRow({ name, bundle, stanceOpen, stanceDefaultPick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "4px 16px 8px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <StanceControl
          wide
          targetLabel={name}
          axes={AFFINITY_AXES}
          bundle={bundle}
          defaultOpen={stanceOpen}
          defaultPick={stanceDefaultPick}
          onCommit={() => {}}
        />
      </div>
      <ShareButton targetLabel={name} onShare={() => {}} />
    </div>
  );
}

function TagPageBody({ bundle, stanceOpen, stanceDefaultPick } = {}) {
  return (
    <>
      <PageHeader title="#saltmaps" backHref="#" backLabel="Back to Explore" />
      <TopicStanceRow name="#saltmaps" bundle={bundle} stanceOpen={stanceOpen} stanceDefaultPick={stanceDefaultPick} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 0" }}>
        <TaggedRow pair={{ pDirected: 0.1, pInterest: 1 }} pending>
          <PostCard attach {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
        </TaggedRow>

        <TaggedRow pair={{ pDirected: 0.55, pInterest: 1 }}>
          <PostCard attach {...SOL_POST} bundle={mkBundle(0.1, 0.1)} />
        </TaggedRow>

        <TaggedRow pair={{ pDirected: 0.4, pInterest: 0.9 }}>
          <CommentCard
            attach
            author={ADA}
            content="Low tide is kinder to the rubbings than noon ever was."
            timestamp="4d"
            license={{ attribution: 0, provenance: 0 }}
            bundle={mkBundle(0.1, 0.1)}
            target="“Salt maps of the coast road” — @sol"
            onOpenTarget={() => {}}
          />
        </TaggedRow>
      </div>
    </>
  );
}

/* ── THE V1.0 FEED KINDS (the three-feed-cards round 2026-09-30; the
   anatomies ruled by jakob 2026-10-01) ─────────────────────────────────────
   jakob's ruling (the fifteen-first round): the four served kinds — Posts,
   Comments, Profiles, Tags — everywhere, feed and search alike. These are the
   three cards a reader meets beside the posts once they turn a kind on. Each
   is a real master, mounted — nothing hand-built (the componentization law).

   THE UNIFIED ROW (jakob 2026-10-01). Every feed card's actions read
   opinion · score · the kind's own act · share. A post's own act is its
   comments; a comment's is its reply, a tag's `Tag a new post with it`; a
   person's slot stands empty until chats land, when the chat glyph takes it.
   The score is the same figure on every kind, spoken `Feed score` — "we will
   have up to 10 rankable objects and it should be the same for all of them" —
   and it opens the same trace (`FeedEntry`), whose top block names the thing
   the card stands for (`ScoreOrigin`).

   THE PROFILE AND THE TAG RIDE `PostCard`, as the post-MVP chat and message
   cards do: its header and ⋮, its row, and the card itself as the door. The
   comment keeps its own master, `CommentCard`, in its thread shape. */
function FeedLeadName({ children }) {
  return <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>;
}
const FEED_LEAD_SMALL = { fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" };
const FEED_LEAD_TITLE = {
  fontSize: "var(--text-title-medium)",
  lineHeight: "var(--text-title-medium--line-height)",
  fontWeight: "var(--text-title-medium--font-weight)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/* THE COMMENT CARD — a slice of its thread (jakob's pick, 2026-10-01). A
   comment is the one feed card whose meaning depends on something else, so it
   says what it answers before a word of it is read: the post as a head row —
   its own mark, its title, its author — and the comment hung under it on a
   connector rule, the way a reply hangs under what it answers. What it
   answers is a post or a comment (the reply pack): a post's head row is its
   title over its author's handle, a comment's — which has no title — its
   author's handle over its first words, `QuotedRow`'s own rule.

   THE DOUBLE DOOR. The head row opens what it names: the post's detail. The
   rest of the card opens the comment's own place — the post's comment
   section, scrolled to this comment. Things with their own meaning keep it:
   the author chip, the chips, the row.

   THE ROW IS THE UNIFIED ONE: the opinion, the score, the comment glyph —
   the reply, which opens that same comment section at this comment with the
   composer already aimed at it — and the share.

   REPLIES NEVER APPEAR IN THE FEED (jakob 2026-10-01). A comment's replies
   live in its thread, and the card carries no `View n replies` line: the feed
   ranks the comment, not its branch, and the door to the branch is the card.

   ITS ⋮ IS THE COMMENT'S MENU (jakob 2026-10-01), the sheet every comment's ⋮
   opens (`CommentMenu`), never the post card's: the card stands for a
   comment, so its menu holds what a comment's does — Save and Cite, then
   `Cited by` and `Opinions on this`, the license closing it. Your own
   comment's adds `Remove` among the acts (`CommentMenuOwn`), as everywhere.
   The card appends the license row itself, so the rows handed it stop short
   of it. */
const FEED_COMMENT_MENU = COMMENT_MENU.filter((row) => row !== LICENSE_ROW);
const FEED_OWN_COMMENT_MENU = OWN_COMMENT_MENU.filter((row) => row !== LICENSE_ROW);
/* WHAT THE HEAD ROW NAMES, PER TARGET (the closing batch, jakob 2026-10-01).
   · AN UNTITLED POST — a text post's title is optional — is named by its
     first words in the title's place, the way `History` lists one and the
     quote names a comment: the words are the post.
   · A REMOVED POST keeps its row, as it keeps its place in every thread:
     the title's place reads `Removed by its author`, the removal mark's own
     line, over the author, who stays; its mark keeps its space empty.

   YOUR OWN COMMENT (`own`) is the same card, its ⋮ opening your own menu;
   nothing else about it changes — the feed card carries no Edit.

   A LONG COMMENT folds at two lines under `More`, the caption's precedent
   (`FEED_COMMENT_CLAMP_LINES`); the card is still the door to its thread.

   A GUEST meets the card as every card: the face opens `GuestGate` (the
   guest feed's rule, `Main`), and the reply glyph is not drawn, since
   `CommentCard` offers a reply only to a reader signed in. Nothing here is
   drawn for a guest: no guest board shows a comment card. */
const FEED_COMMENT_CLAMP_LINES = 2;
const REMOVED_BY_AUTHOR = "Removed by its author";
const commentTarget = (parent, kind) =>
  kind === "comment"
    ? { kind: "comment", label: `@${parent.author.handle}'s comment`, title: "@" + parent.author.handle, sub: parent.content }
    : parent.removed
      ? { kind: "post", label: `@${parent.author.handle}'s removed post`, title: REMOVED_BY_AUTHOR, sub: "@" + parent.author.handle, removed: true }
      : {
          kind: "post",
          label: `“${parent.title ?? parent.content}” — @${parent.author.handle}`,
          title: parent.title ?? parent.content,
          sub: "@" + parent.author.handle,
          cover: parent.media?.[0]?.src,
        };

function CommentFeedCard({ author, content, timestamp, parent, parentKind = "post", media, sensitive, topics = [], references = 0, score, bundle, own = false, node }) {
  const target = commentTarget(parent, parentKind);
  return (
    <CommentCard
      author={author}
      content={content}
      timestamp={timestamp}
      media={media}
      sensitive={sensitive}
      target={target.label}
      targetKind={target.kind}
      targetShape="thread"
      targetDetail={{ title: target.title, sub: target.sub, cover: target.cover, removed: target.removed }}
      clampLines={FEED_COMMENT_CLAMP_LINES}
      onOpenTarget={() => {}}
      onOpen={() => {}}
      bundle={bundle}
      topics={topics}
      references={references}
      score={score}
      onOpenScore={() => {}}
      onReply={() => {}}
      replyGlyph
      onShare={() => {}}
      license={{ attribution: 0, provenance: 0 }}
      menuItems={own ? FEED_OWN_COMMENT_MENU : FEED_COMMENT_MENU}
      node={node}
    />
  );
}

/* THE PROFILE CARD — the top of their profile (jakob's pick, 2026-10-01).
   The person leads at a size no author chip takes: the profile header's own
   compact shape at card scale, the picture beside the name in a title's
   weight and the handle under it, the bio in the quiet colour below — so a
   person met in the feed reads as their page arriving, never as a text post
   with only a body. The opinion is the row's standard face, the control every
   other card wears. The row reads opinion · score · share: the kind's own act
   is the chat glyph, and its slot waits for chats. Its ⋮ is the profile's own
   menu, less the share row the row already carries; the card opens the
   profile. */
const FEED_PROFILE_MENU = (handle) => [
  SAVE_ROW,
  { label: "Mention in a new post", onSelect: () => {} },
  { label: HIDE_ACTOR_LABEL("@" + handle), onSelect: () => {} },
];
const FEED_BIO = {
  margin: 0,
  fontSize: "var(--text-body-medium)",
  lineHeight: "var(--text-body-medium--line-height)",
  color: "var(--text-secondary)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/* A DELETED ACCOUNT STILL RANKS (the closing batch, jakob 2026-10-01). The
   husk keeps its records and its standing (erasure.md §3), so it reaches a
   feed like anyone; only its identity payloads went. The card draws it the
   way every surface draws a redacted actor (`ActorChip`'s `redacted`): the
   disc keeps its space and fills with nothing, the name's place reads
   `Deleted account` in the system's voice, `text-secondary`, and no handle
   stands under it — the stored form is a uniqueness device, not a name. No
   bio: it went with the rest. Its ⋮ is `PROFILE_DELETED_MENU` less the share
   the row carries, and every control names it `this account`.

   A GUEST meets the card as every card: the face opens `GuestGate` (the
   guest feed's rule, `Main`). No guest board draws one. */
const FEED_DELETED_PROFILE_MENU = PROFILE_DELETED_MENU.filter((row) => row.label !== "Share this profile");

function ProfileFeedCard({ person, src, bio, score, bundle, redacted = false }) {
  const handle = redacted ? null : "@" + person.handle;
  return (
    <PostCard
      lead={
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", minWidth: 0 }}>
          <MonogramAvatar name={person.displayName} src={src} size={56} redacted={redacted} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            {redacted ? (
              <span style={{ ...FEED_LEAD_TITLE, color: "var(--text-secondary)" }}>{REDACTED_ACTOR_NAME}</span>
            ) : (
              <>
                <span style={FEED_LEAD_TITLE}>{person.displayName}</span>
                <span style={FEED_LEAD_SMALL}>@{person.handle}</span>
              </>
            )}
          </span>
        </span>
      }
      main={bio && !redacted ? <p style={FEED_BIO}>{bio}</p> : undefined}
      targetLabel={handle ?? "this account"}
      bundle={bundle}
      score={score}
      onOpenScore={() => {}}
      menuItems={redacted ? FEED_DELETED_PROFILE_MENU : FEED_PROFILE_MENU(person.handle)}
      menuLabel={redacted ? "More about this account" : "More about " + handle}
      onOpen={() => {}}
    />
  );
}

/* THE TAG CARD — why it reaches you, and a glimpse (jakob's pick,
   2026-10-01). jakob's story for it: "this is a hashtag that ranks high for
   you (based on your graph) and there might be some interesting stuff to
   check out behind it". The score tells the first half on every card; this
   card also says it in words, under the name — whom it reaches the reader
   through, the strongest paths' people, in the drill-down's own vocabulary.
   The body is the second half: a glimpse of the newest things tagged, their
   marks side by side and the newest one named, so the card reads as a door
   to a place rather than a post inside a header.

   ITS MARKS SIT ON THE CARD, so they take the card's tile tone (`NodeMark`'s
   `onCard`, jakob: the `#` takes the darker tone).

   THE ROW IS THE UNIFIED ONE: the topic's Affinity with the tag page's own
   four ends, the score, the kind's own act — `Tag a new post with it`, the
   compose glyph, opening the composer with the tag already staged, the
   person menu's `Mention in a new post` sibling — and the share the tag
   page's own row ends with. A Type has no license, is never cited and is not
   saved, so the card carries no ⋮. The card opens the tag's page.

   THE TAGGED THINGS ARE `TagPage`'s, newest first, the page's order.

   THE WHY-LINE NAMES TWO PEOPLE AT MOST (the closing batch, jakob 2026-10-01).
   One or two are named — `Reaches you through @ada and @tobias`; past two,
   the first and a count — `Reaches you through @ada and 3 others`. Where the
   full line would not fit its one line, it compresses to the drill-down's own
   `Through @ada`, the strongest path's person; a handle so long that even
   that does not fit ellipsizes, the `ActorChip` truncation law ("…"). A
   static render cannot measure, so the compression is chosen on an estimate
   from the line's own tokens: about half an em to the glyph at `body-small`
   across the lead's width beside the `#` tile and the age, 46 characters.

   AN EMPTY TAG still ranks — it reaches the reader through people's opinions
   of it, not through what carries it — so its card keeps the why-line and its
   glimpse gives way to one quiet line, `Nothing carries this tag right now.`,
   `TagPageEmpty`'s own first sentence, with no age, since nothing is newest.

   A GUEST meets the card as every card: the face opens `GuestGate`, and so
   does the compose glyph, as the guest feed's `New post` does (`Main`). No
   guest board draws one. */
const TAG_ACT = "Tag a new post with it";
const WHY_LINE_CHARS = 46;
const TAG_NOTHING_RECENT = "Nothing carries this tag right now.";
const reachesThrough = (handles) => {
  const named = handles.map((h) => "@" + h);
  const full = `Reaches you through ${named.length > 2 ? `${named[0]} and ${named.length - 1} others` : named.join(" and ")}`;
  return full.length > WHY_LINE_CHARS ? `Through ${named[0]}` : full;
};
const SALTMAPS_TAGGED = [
  { kind: "post", title: "Low tide at six tomorrow — anyone walking the flats?", by: TOBIAS, age: "1h" },
  { kind: "post", title: SOL_POST.title, by: SOL, age: "3d", cover: SOL_POST.media[0].src },
  { kind: "comment", title: "Low tide is kinder to the rubbings than noon ever was.", by: ADA, age: "4d" },
];

function TagFeedCard({ name, through, tagged, score, bundle }) {
  const [newest, ...rest] = tagged;
  const glimpse = newest ? (
    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
      <span style={{ display: "flex", gap: "var(--space-1)", flex: "none" }}>
        {tagged.map((thing) => (
          <NodeMark key={thing.title} kind={thing.kind} src={thing.cover} onCard />
        ))}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{newest.title}</span>
        <span style={FEED_LEAD_SMALL}>@{newest.by.handle}{rest.length > 0 && ` · and ${rest.length} more`}</span>
      </span>
    </span>
  ) : (
    <span style={FEED_LEAD_SMALL}>{TAG_NOTHING_RECENT}</span>
  );
  return (
    <PostCard
      lead={
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <NodeMark kind="topic" onCard />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <FeedLeadName>{name}</FeedLeadName>
            <span style={{ ...FEED_LEAD_SMALL, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{reachesThrough(through)}</span>
          </span>
        </span>
      }
      main={glimpse}
      timestamp={newest?.age}
      targetLabel={name}
      bundle={bundle}
      score={score}
      onOpenScore={() => {}}
      stanceAxes={AFFINITY_AXES}
      act={<GlyphAction glyph="add" label={TAG_ACT} onPress={() => {}} />}
      onOpen={() => {}}
    />
  );
}

/* ── THE TOPICS THE READER HOLDS (the topic round, 2026-09-14) ─────────────
   The set behind Explore's door and behind the feed filter's topic narrowing,
   so both read one fixture and the door's count cannot drift from the list it
   counts. Held means the netted Affinity is not (0, 0) — `#wellness` is held
   against, which is exactly as held, and exactly as public.

   THE ORDER IS THE BOARD'S CLAIM: strongest association first, down past
   nothing into the ones held against (`ProfileStances`' order). */
const HELD_TOPICS = [
  { name: "#saltmaps", pair: { pDirected: 0.6, pInterest: 0.35 } },
  { name: "#coastroad", pair: { pDirected: 0.45, pInterest: 0.7 } },
  { name: "#fieldnotes", pair: { pDirected: 0.3, pInterest: 0.15 }, pending: true },
  { name: "#tidetables", pair: { pDirected: 0.15, pInterest: 0.5 } },
  { name: "#wellness", pair: { pDirected: -0.65, pInterest: -0.3 } },
];

/* WHAT THE FEED FILTER MAY NARROW TO — derived, never listed twice. The topic
   feed admits POSITIVE association only (jakob's predicate), so the section's
   chips are the held set minus the ones held against; deriving it here means
   the filter and Your topics can never disagree about who is missing and why. */
const FEED_TOPICS = HELD_TOPICS.filter((topic) => topic.pair.pDirected > 0).map((topic) => topic.name);

/* THE INBOUND LIST ITSELF, NEWEST FIRST — a ruled departure from the opinions
   sheet's strongest-first, and deliberate (jakob, 2026-09-14). The opinions
   list is a standing: a set of positions that hold, where the strongest is the
   one worth reading. This is a CHRONICLE of other people's acts — each one
   happened at a moment, and what a reader wants from it is what has just
   arrived. Strength is not the question a chronicle answers.

   THE ROWS ARE `ReferenceRow`, the shape every reference in this system wears:
   the kind's mark, the citing artifact, and the pair its author signed on the
   citation — a citation's pair, both axes signed, read through the twenty
   faces. The count on the post's line IS this list's length. */
const CITING_ARTIFACTS = [
  { kind: "post", name: "Where the salt goes in winter", src: "post-photo.jpg", pair: { pDirected: 0.7, pInterest: 0.5 } },
  { kind: "comment", name: "Answering the tide-market piece", pair: { pDirected: 0.4, pInterest: 0.65 }, pending: true },
  { kind: "post", name: "Three mornings on the wall", pair: { pDirected: 0.15, pInterest: 0.9 } },
  { kind: "post", name: "A honey stand and a headland", pair: { pDirected: -0.3, pInterest: 0.35 } },
];

/* ── THE INVITES SCREEN (the invites round, 2026-09-15) ────────────────────
   Drawn once here because five boards stand on it: the list itself, the
   create sheet and its expiry chooser, the fresh link, the approval pad and
   the reject dialog. Everything above a sheet or a wash is the board's; the
   page under it is this.

   THE MOCK INVITE LINKS. `auth.md` (*Link URLs*) fixes the shape —
   `https://<web-origin>/join/<link-id>` — and leaves the origin
   per-environment, so the host below is invented the way the mock Liquid
   addresses above are: the SHAPE is the product's, the letters are not. The id
   is the capability and the link is the only shape it takes on screen; the
   door's tolerance for a bare one stays at the door, where a reader never has
   to think about it. */
const SOL_INVITE_ID = "8f3c1d2a-5b47-4e90-9a61-2d7fbc084e15";
const SOL_INVITE_LINK = `https://cogra.social/join/${SOL_INVITE_ID}`;
const SOL_INVITE_LINK_OPEN = "https://cogra.social/join/c47b19e0-3a52-4f68-b1d9-6e0a85f37c24";

/* THE ASK LINK — the invite link's mirror, and shaped as its mirror: the same
   origin, its own path, one id. What it is NOT is the difference that matters.
   An invite link points at a SLOT its issuer opened, so it expires and it can
   be used up; an ask link points at a PERSON, so it does neither. It stands
   for as long as the person is waiting to be let in, and every member who
   opens it is answering the same standing question. */
const ASK_LINK = "https://cogra.social/vouch/5d9e7a41-b062-4c38-8e5f-1a4703cbd926";

/* THE ROW'S OWN CLOSE, the Saved list's `Unsave` one surface over: icon-only,
   `ContentRow`'s `action` slot, `text-secondary`, its name only in the
   accessibility tree. A row in this list has exactly two things a reader can
   do to it — approve it, which is the row, and close it, which is this — so a
   ⋮ would be a menu of one. The word it does not say is "reject": nothing is
   deleted and the person keeps the account they made, so the glyph is `close`
   and the name says what happens, not how it feels.

   IT TAKES THE HANDLE, unlike `Unsave`, because a list of applications is a
   list of PEOPLE and four identical "Close" buttons is four chances for a
   screen reader to close the wrong one. */
const CloseApplication = ({ handle }) => (
  <button
    type="button"
    aria-label={`Close ${handle}'s application`}
    className="cg-state cg-focus cg-hit"
    style={{
      display: "grid",
      placeItems: "center",
      height: "40px",
      width: "40px",
      border: 0,
      background: "none",
      borderRadius: "var(--radius-full)",
      color: "var(--text-secondary)",
      cursor: "pointer",
      padding: 0,
    }}
  >
    <Icon name="close" size={20} />
  </button>
);

/* APPLICATIONS ARE GROUPED BY THE LINK THEY CAME THROUGH (jakob 2026-09-15:
   "if someone bots us from the start it would be nice to have.. we add
   batching.. batched by invite link?"). A link that leaks is the failure mode
   this queue has, and it arrives as a burst of applications that are all the
   same application — one link, one leak, one answer. Flat and undifferentiated,
   the reader had to close them one at a time and could not even see that they
   were one event.

   THE GROUP CARRIES THE BATCH ACT, AND THE LINK CARD DOES NOT. `PayoutAddress`
   is allowed exactly one inline word and a live link already spends it on
   `Revoke` — a card with a second inline act stops reading as a string with a
   home, which is that component's own rule. The group header is the other
   place the batch belongs and it is the better one anyway: the count is right
   there, so the gesture is next to the number it acts on.

   THE LIST IS STILL ORDERED BY AGE. Grouping does not reorder by what the
   reader can act on — the rule that matters — so groups sit in the order of
   their oldest waiting application and rows sit by age inside them. The oldest
   application in the queue is still the first row on the screen.

   ONE WAITING GETS NO BATCH. `Close all 1` is the row's own close with a
   longer name, so the header carries the label and the count and stops there.

   THE COUNT IS WHAT IS WAITING, not what the link has ever let through: a
   closed application is not closed again, and an approved one is gone. */
const ApplicationGroup = ({ label, count }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "4px 4px 0" }}>
    <span
      style={{
        fontSize: "var(--text-label-medium)",
        lineHeight: "var(--text-label-medium--line-height)",
        fontWeight: "var(--text-label-medium--font-weight)",
        letterSpacing: "var(--text-label-medium--letter-spacing)",
        color: "var(--text-secondary)",
      }}
    >
      {label} · {count} waiting
    </span>
    {count > 1 && (
      <Button variant="text" size="sm" ariaLabel={`Close all ${count} applications from this link`}>
        Close all
      </Button>
    )}
  </div>
);

/* THE VOUCH CARD — `VouchBack`'s card, and the same card under the pad's wash
   on `VouchBackPad`, so it is written once.

   IT WEARS THE OLIVE REGISTER (jakob 2026-10-02, the olive split: a feed card
   that asks the reader to act wears the account-notice register; one that only
   informs stays neutral). `tertiary-container` ground, `on-tertiary-container`
   ink for the title and the sentence alike, and the panel's own pair turned
   over for the committing button (`Button`'s `inverse`) — `NoticePanel`'s
   anatomy, held by a card. The way out is a text button in the panel's ink,
   because a `primary` word on the olive is a second colour family arguing with
   the panel's own, the same reason the filled button turns over. `body` and
   `actions` are what the two boards differ in: the closed card says what the
   button opens, and its row holds the buttons rather than the pad's anchor. */
function VouchBackCard({ body, actions }) {
  return (
    <Card style={{ flex: "none", background: "var(--tertiary-container)", color: "var(--on-tertiary-container)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <MonogramAvatar name="Mira Voss" src="inviter.jpg" size="lg" />
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-title-medium)",
            lineHeight: "var(--text-title-medium--line-height)",
            fontWeight: "var(--text-title-medium--font-weight)",
          }}
        >
          @mira vouched you in
        </h2>
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{body}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>{actions}</div>
    </Card>
  );
}

/* ONE LINE OF A PAD'S NOTE. `VouchBackPad` drew it first and drew it alone;
   the approval pad on the other side of the same handshake draws the identical
   line, so it is written once here rather than twice on two boards that must
   never disagree about what a pad's own voice looks like. */
function PadLine({ children }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

/* THE PAD'S OWN LINES wherever a vouch is being given. They are not one-time
   coaching the way `VouchBackPad`'s are: vouching somebody in is rare,
   consequential and priced, and the two facts below are true every single time
   it happens.

   IT TAKES THE HANDLE because the same pad now opens from two places — a
   queue of one's own, and an ask link a stranger to that queue sent — and the
   act is identical from both. One note, two boards: the member who answers an
   ask link is doing exactly what the queue's own reader would have done. */
function ApprovePadNote({ handle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PadLine>Vouching is the act. Set signs your opinion on {handle} and brings them in.</PadLine>
      <PadLine>It is one signed, priced act — and it is theirs to answer: their opinion back completes the pair.</PadLine>
    </div>
  );
}

/* THE PAGE ITSELF.

   APPLICATIONS LEAD, LIVE LINKS FOLLOW. The queue is the only half that can
   be waiting on the reader, and the half a dot on the profile sent them here
   for; a link sitting quietly is a thing they made, not a thing they owe.

   THE SECTION IS `Applications`, NOT "Waiting on you". Only one of these rows
   is waiting on the reader — the other is waiting on its own applicant — and a
   caption that says otherwise makes the second row a lie. Who is waited on is
   the ROW's to say, on the second line, which is where `ContentRow` puts
   status.

   OLDEST ON TOP, BY AGE ALONE — AND GROUPING DOES NOT DISTURB IT. `@imke`
   applied nine days ago and is not fully registered yet; `@rafa` applied three
   days ago and is ready. The not-ready row standing first is the drawing that
   records the rule: this list is ordered by how long someone has been waiting,
   never by whether the reader can act on them. Since applications are now
   grouped by the link they came through, the rule reaches one level up —
   groups sit in the order of their OLDEST waiting application and rows sit by
   age inside them — so the oldest application in the queue is still the first
   row on the screen, and nothing has been sorted by how actionable it is.

   AN APPLICANT HAS NO PICTURE, EVER. There is no Profile to carry one until
   approval lands (`invitations.md` §4), so the disc is the monogram from the
   handle — the designed placeholder, and here the only honest drawing. For the
   same reason there is no display name: a handle is all the account has.

   THE STATUS LINE IS THE READER'S FACT, NOT THE MECHANISM'S (jakob
   2026-09-15). Which of the two proofs is still missing — a key, a confirmed
   email — is the applicant's errand and no concern of the person deciding
   whether to vouch for them. What the approver needs from this line is whether
   they can act, so both states say the one thing that is true of both:
   `Not fully registered yet`.

   THE NOT-READY ROW IS STILL PRESSABLE, and answers with a snackbar in the
   same words — `ProfileApplicant`'s locked rows, which say why rather than
   refusing silently. An inert row beside a live close control would read as a
   row that had stopped working.

   DEAD LINKS ARE NOT HERE. A revoked or expired link leaves the list the
   moment it stops working, so everything under `Live links` is a link someone
   can still use — which is why the single-use card can say its slot is open
   simply by being on the page.

   `approving` SWAPS THE READY ROW'S CONTROL for the stance anchor the pad
   blooms from. The row's one control is the row's one other act, and on the
   approval board that act is the opinion being given; the close stands down
   while it is open, under the wash, where it could not be pressed anyway.

   A KEPT APPROVAL SURFACES HERE AS ITS OWN CARD (jakob 2026-10-02, the
   fix-fix round's 22). An approval set while the key was elsewhere waits on
   the device as pending (`PadKeyAbsent`); once the key is back it never
   joins the kept picks' batch — the review lists plain opinions only. It
   surfaces on this page, where approving lives, with its ceremony kept: it
   signs through the approval pad, and the vouch lands and notifies them as
   any approval does. It is the kept vouch-back's twin, which surfaces as its
   own card on the feed and signs through `VouchBackPad` into `VouchedIn`.
   Neither twin is drawn as a state of its own: the ready row here, and the
   vouch-back card there, are the cards they surface as. */
function InvitesBody({ approving = false }) {
  return (
    <>
      <PageHeader title="Invites" backHref="/profile" backLabel="Back to your profile" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "8px 0 0" }}>
        {/* THE STANDING ENTRY POINT IS A NOUN, the empty state's action a verb
            — the product's own split, kept: the bottom bar says `New post` and
            the empty feed says `write the first post`. The sheet this opens is
            titled `New invite` too, so the button and the surface it raises say
            one thing; `Create invite` is the word for the act, and it belongs
            on the button that performs it and on the empty state that has
            nothing else to offer.

            IT IS A FILLED BUTTON AND NOT A FLOATING ONE. This system has no
            FAB — the bottom bar's compose action is the app's one floating
            create, and this surface carries no bar — so the page's one
            committing action stands in the column, at its head, where a long
            queue can never bury it. */}
        <div style={{ padding: "0 16px" }}>
          <Button style={{ width: "100%" }}>New invite</Button>
        </div>

        <SectionLabel>Applications</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <ApplicationGroup label="Many uses" count={4} />
          <ContentRow
            variant="chronicle"
            chevron={false}
            name="imke"
            title="@imke"
            second="Not fully registered yet"
            trailing="9d"
            action={<CloseApplication handle="@imke" />}
            onOpen={() => {}}
          />
          <ContentRow
            variant="chronicle"
            chevron={false}
            name="vora81"
            title="@vora81"
            second="Not fully registered yet"
            trailing="1d"
            action={<CloseApplication handle="@vora81" />}
            onOpen={() => {}}
          />
          <ContentRow
            variant="chronicle"
            chevron={false}
            name="vora82"
            title="@vora82"
            second="Not fully registered yet"
            trailing="1d"
            action={<CloseApplication handle="@vora82" />}
            onOpen={() => {}}
          />
          <ContentRow
            variant="chronicle"
            chevron={false}
            name="vora83"
            title="@vora83"
            second="Not fully registered yet"
            trailing="1d"
            action={<CloseApplication handle="@vora83" />}
            onOpen={() => {}}
          />
          <ApplicationGroup label="Single use" count={1} />
          <ContentRow
            variant="chronicle"
            chevron={false}
            name="rafa"
            title="@rafa"
            second="Ready for your approval"
            trailing="3d"
            action={
              approving ? (
                <StanceControl
                  targetLabel="@rafa"
                  helpLabel="How vouching works"
                  defaultOpen
                  defaultPick={{ pDirected: 0.1, pInterest: 0.1 }}
                  padNote={<ApprovePadNote handle="@rafa" />}
                />
              ) : (
                <CloseApplication handle="@rafa" />
              )
            }
            onOpen={() => {}}
          />
        </div>

        <SectionLabel>Live links</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <PayoutAddress
            label="Single use · not used yet"
            address={SOL_INVITE_LINK}
            onCopy={() => {}}
            copyLabel="Copy the link"
            onChange={() => {}}
            changeLabel="Revoke"
            caption="Expires in 7 days · 22.09.2026"
          />
          <PayoutAddress
            label="Many uses"
            address={SOL_INVITE_LINK_OPEN}
            onCopy={() => {}}
            copyLabel="Copy the link"
            onChange={() => {}}
            changeLabel="Revoke"
            caption="Expires in 2 days · 17.09.2026"
          />
        </div>

        <div style={{ flex: 1 }} />
      </div>
    </>
  );
}

/* THE CREATE SHEET, shared the moment the expiry chooser opened over it — the
   same rule the comments thread keeps under its own second sheet: a body drawn
   on two boards is drawn once.

   TWO DECISIONS AND NO MORE. A link carries no stance any more (the prefill is
   gone from the mechanic), so what is left to choose is who may use it and how
   long it lives. Anything else on this sheet would be a third decision invented
   to fill it.

   THE SWITCH IS WORDED AS THE RESTRICTION, so ON is the narrow thing and the
   label alone says what ON does — which is why this row carries no status line
   under it. What OFF does is the group's FOOTNOTE: the consequence is the thing
   a reader needs once and never again, which is exactly what a footnote is for.

   SINGLE USE IS THE DEFAULT. A targeted invite is the ordinary one and the safe
   one — a leaked link stages at most one stranger (`invitations.md` §6) — so the
   default sits where a reader who changes nothing is least exposed. */
function NewInviteSheet() {
  return (
    <BottomSheet open ariaLabel="New invite">
      <SheetTitle>New invite</SheetTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px" }}>
        <SettingsGroup footnote="With it off, anyone holding the link can apply until it expires. Either way each person still needs your approval, one at a time.">
          <SettingsRow label="Only one person can use it" checked onOpen={() => {}} />
          <SettingsRow label="Expires after" value="7 days" onOpen={() => {}} />
        </SettingsGroup>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button>Create invite</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ── THE ONBOARDING INTRO (jakob's rulings, the batch-rulings round) ───────
   Five full-screen cards shown once, on the first authenticated feed entry,
   from applicant on. The frame is written here because five boards draw it and
   differ only in their illustration and their words.

   THE ILLUSTRATIONS ARE NOT GATED BY THE APP'S OWN ELEMENTS (jakob's ruling).
   They are drawn with whatever means teaches fastest — lines, dots, plates —
   and where a real component appears it IS the real component: the pad is
   `StancePad`, every face is `MonogramAvatar`. A post card, a comment and a
   chat bubble appear as LIKENESSES rather than as mounted masters, because a
   mounted `PostCard` would put seven live controls on a card whose only live
   controls are Skip and Next; the likenesses are built from the masters' own
   tokens, radii and anatomy so they cannot drift in look.

   THE FRAME IS SKIP · ILLUSTRATION · WORDS · DOTS · NEXT. Skip stands on every
   card, top-right, and leaves for the feed; the last card's button reads
   `Start reading` instead of `Next`. The dots are an indicator and not a
   control — a pager a reader can drive would make five boards into twenty-five
   edges and teach nothing the buttons do not. */
const INTRO_STEPS = 5;

function IntroDots({ step }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "20px 0 16px" }}>
      <span style={SR_ONLY}>{`Step ${step} of ${INTRO_STEPS}`}</span>
      {Array.from({ length: INTRO_STEPS }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "var(--radius-full)",
            background: index + 1 === step ? "var(--primary)" : "var(--border-field)",
          }}
        />
      ))}
    </div>
  );
}

function IntroFrame({ step, headline, lines, note = null, cta = "Next", children }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: "none", display: "flex", justifyContent: "flex-end", padding: "8px 12px 0" }}>
        <Button variant="text">Skip</Button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        {children}
      </div>
      <div style={{ flex: "none", padding: "0 24px 32px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          {headline}
        </h1>
        {lines.map((line) => (
          <p
            key={line}
            style={{
              margin: "8px 0 0",
              fontSize: "var(--text-body-medium)",
              lineHeight: "var(--text-body-medium--line-height)",
              letterSpacing: "var(--text-body-medium--letter-spacing)",
              color: "var(--text-secondary)",
            }}
          >
            {line}
          </p>
        ))}
        {note}
        <IntroDots step={step} />
        <Button style={{ width: "100%" }}>{cta}</Button>
      </div>
    </div>
  );
}

/* The illustrations' own stage: a fixed box the pieces are placed in, with one
   SVG under them carrying every line. Absolute placement in ONE coordinate
   space is what keeps a drawing of lines-between-things from drifting apart at
   a different text size. */
function IntroStage({ width = 342, height = 300, children }) {
  return (
    <div style={{ position: "relative", width, height, flex: "none" }}>{children}</div>
  );
}

function IntroLines({ width = 342, height = 300, children }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      {children}
    </svg>
  );
}

/* A node's caption — the word under a face, `label-small` and quiet, so the
   drawing says who each dot is without a legend beside it. */
function IntroCaption({ children, x, y, width = 88 }) {
  return (
    <span
      style={{
        position: "absolute",
        left: x - width / 2,
        top: y,
        width,
        textAlign: "center",
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        letterSpacing: "var(--text-label-small--letter-spacing)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

/* A face on the stage, centred on (x, y) — the real avatar, placed. */
function IntroFace({ x, y, size = 44, name, src }) {
  return (
    <span style={{ position: "absolute", left: x - size / 2, top: y - size / 2, display: "block" }}>
      <MonogramAvatar name={name} size={size} src={src} />
    </span>
  );
}

/* THE POST CARD AS A LIKENESS. `PostCard`'s own anatomy — the author line, the
   title, the picture on the card's own corner — at the card's radius and fill,
   with nothing pressable on it. */
function IntroPostCard({ title, timestamp = "2h", author = ADA, src = "post-photo.jpg", height = 92, tail = null }) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        overflow: "hidden",
        border: "1px solid var(--border-hairline)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "10px var(--space-3)" }}>
        <MonogramAvatar name={author.displayName} src={author.src} />
        <span style={{ flex: 1, fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
          @{author.handle}
        </span>
        <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{timestamp}</span>
      </div>
      <div style={{ padding: "0 var(--space-3) 10px", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{title}</div>
      <img src={src} alt="" style={{ display: "block", width: "100%", height, objectFit: "cover" }} />
      {tail}
    </div>
  );
}

/* ── THE PICK STEP'S INERT GALLERY (the video conform round) ───────────────
   The device-gallery grid with the picking turned off: no selection rings,
   nothing to tap, because a post carries pictures OR one video and the clip
   is already in. Both staged-clip boards draw it — the step is the same step
   before and after a cover exists — so the markup lives here rather than
   twice. */
function DeadGrid() {
  const shades = [
    "var(--surface-container-highest)",
    "var(--surface-container-high)",
    "var(--surface-container-highest)",
    "var(--surface-container)",
    "var(--surface-container-high)",
    "var(--surface-container-highest)",
    "var(--surface-container-high)",
    "var(--surface-container)",
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 3, padding: "4px 4px 0", overflow: "hidden", alignContent: "flex-start", opacity: 0.45 }}>
      <div style={{ position: "relative", width: 125, height: 125, overflow: "hidden", outline: "1px solid var(--border-hairline)", outlineOffset: -1 }}>
        <img src="post-photo.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <div style={{ position: "relative", width: 125, height: 125, overflow: "hidden", outline: "1px solid var(--border-hairline)", outlineOffset: -1 }}>
        <img src="inviter.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <div style={{ position: "relative", width: 125, height: 125, overflow: "hidden", outline: "1px solid var(--border-hairline)", outlineOffset: -1 }}>
        <img src="gallery-market.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      {shades.map((bg, index) => (
        <div key={index} style={{ width: 125, height: 125, background: bg, outline: "1px solid var(--border-hairline)", outlineOffset: -1 }} />
      ))}
    </div>
  );
}
