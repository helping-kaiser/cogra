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
  ProfileHeader,
  EmptyState,
  LoadingState,
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
  FilterSection,
  OrderSection,
  FEED_KINDS,
  FEED_FILTER_DEFAULT,
  HelpDot: SystemHelpDot,
  MoneyFigure,
  CgtMark,
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
  WalletBalance,
  LedgerRow,
  PayoutAddress,
  PayoutAddressRow,
  EarnedChart,
  WashCard,
  StancePad,
  SeveranceConfirm,
  StanceReadout,
  OwnStanceReadout,
  StanceValue,
  StanceSlider,
  TAG_RANGES,
  TaggedRow,
  TransportError,
  SensitiveVeil,
  SensitiveScope,
  RedactedContent,
  MediaDisc,
  VideoTransport,
  SeekLine,
  ShareButton,
  ExplainableNumber,
  MediaViewer,
  ReelRail,
  ReelCaption,
  PinnedClip,
  LICENSE_MENU_LABEL,
  LicenseTerms,
  ATTRIBUTION_TIERS,
  PROVENANCE_TIERS,
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

/* Mock Liquid addresses for the wallet boards — shape and length of a real
   confidential address, content invented. */
const SOL_ADDRESS = "lq1qq2xvpcvfup5j8zscjq05eqylmrc6javzn30v78y7255695yz4t9r5v5m8g6snm4gvsvvzp6mzurcem6ms70epwqmwtnw2pex";
const SOL_ADDRESS_NEW = "lq1qqw7t3xk0zfvljmv2u49h5tld6mfj7z2vhnn0mjcz2q0edgp5yh3l5wxk8m9dqrrf0e2h4t8ur5cem2n970q4wsxm5u8f30a";

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
   the card's own width wherever the card is not a stretched feed child. */
function TaskCard({ title, body, children }) {
  return (
    <Card
      style={{
        flex: "none",
        boxSizing: "border-box",
        border: "var(--ring-task-width) solid transparent",
        background:
          "linear-gradient(var(--surface-card), var(--surface-card)) padding-box, var(--ring-task) border-box",
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
   detail) — two dots would be two menus for one post. */
function DetailHeader({ items }) {
  return <PageHeader backHref="#" backLabel="Back to feed" action={<OverflowMenu items={items} ariaLabel="More on this post" />} />;
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
const OWN_POST_MENU = [
  SAVE_ROW,
  CITE_ROW,
  { label: "Edit", onSelect: () => {} },
  { label: "Mark as sensitive", onSelect: () => {} },
  { label: "Remove", onSelect: () => {} },
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
   the way out, and this page's rare acts belong beside its common ones. */
function ProfileOtherBody({ bundle } = {}) {
  return (
    <>
      <PageHeader title="@ada" backHref="#" backLabel="Back" />
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
      <PageHeader backHref="#" backLabel="Back" />
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
function ReplyDraft() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuotedRow
          title="The long way home — @ada"
          snippet="The light does something at the third headland that I have never managed…"
          name="Ada Okonkwo"
          src="comment-camera.jpg"
        />

        <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>
          The third headland light is real — I have a print from 2019 that almost catches it. Almost.
          <Caret />
        </p>

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
   license sheet, the sensitive sheet and the "?" dialog stand on. */
function ComposeSealBody({ cited = 1, tags = SEAL_TAGS }) {
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
                },
          ]}
          total={`${1 + tags.length + cited} things, signed together`}
          note="They land together, or none does."
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value="Public domain — your default" action="Change" />
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

        <SealFooter signLabel="Sign and publish" />
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
            Toward "The long way home"
          </span>
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
            <span className="cg-exact" style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.10 / +0.10</span>
          </span>
          <span style={SR_ONLY}>
            Nice, For or against +0.10, How much reaches you +0.10
          </span>
        </div>

        <div role="group" aria-label="Opinion pad for the post you answer" style={{ alignSelf: "stretch" }}>
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
   state — what could still be added, lined up with what has been. */
function ReplySealBody({ cited = 0 }) {
  return (
    <>
      <WizardHeader
        title="What you sign"
        leaveLabel="Leave — the reply is discarded"
        stageLabel="Last step"
        help="How signing works"
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Reply to "The long way home" — 89 characters.</QuietNote>

        {/* The all-or-nothing subline appears the moment a signature carries
            more than one thing (`ActsCard`'s rule), so the bare comment —
            one act signed — draws neither it nor the plural total. */}
        <ActsCard
          rows={[
            { label: "Comment", value: "Reply to @ada's post", count: "1", countNoun: "comment" },
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
          <FactRow label="License" value="Public domain — your default" action="Change" />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        {/* The opinion the reply carries is a fact about replying, not about
            this row — so it stands under the ruled block rather than inside
            it, where `FactRow` has no slot for it. */}
        <QuietNote>Replying also signs your opinion on the post it answers.</QuietNote>

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign comment" />
      </div>
    </>
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
   under it, which is `TextField`'s arrangement exactly. */
function WordsBody({ paragraphs, cap, used, error }) {
  const spent = used ?? [...paragraphs.join("\n\n")].length;
  const over = cap != null && spent > cap;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-1)", minHeight: 0 }}>
      <div
        style={{
          flex: 1,
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
   field over its cap does to the step. Nothing else about the stage moves. */
function ComposeDetailsBody({
  title = "Salt maps of the coast road",
  titleError,
  description = "Rubbings from three weekends at low tide — paper against the salt crust.",
  descriptionError,
  nextDisabled = false,
}) {
  return (
    <>
      <WizardHeader title="Details" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <PickedRow
          items={[{ src: "post-photo.jpg" }, { src: "inviter.jpg" }]}
          caption="2 pictures — the body"
          onManage={() => {}}
        />
        <DescribeCounter described={0} total={2} onDescribe={() => {}} />

        <TextField label="Title" corner="Optional" cap={100} value={title} error={titleError} />

        <TextField label="Description" corner="Optional" rows={3} cap={500} value={description} error={descriptionError} />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Tags</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TopicRemovable topic="fieldnotes" onEdit={() => {}} />
            <TopicRemovable topic="coastroad" onEdit={() => {}} />
          </div>
          <InlineAction size="sm" selfStart>+ Add a tag</InlineAction>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <StagedReference
            kind="post"
            name="The long way home — @ada"
            sub="Post"
            src="post-photo.jpg"
            pair={{ pDirected: 0.1, pInterest: 0.1 }}
            onEdit={() => {}}
          />
          <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }} disabled={nextDisabled}>Next</Button>
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
function EditComposeBody({ unchanged = false } = {}) {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — your draft is kept" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
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
          <QuietNote>Withdrawn: #coastroad</QuietNote>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          {/* The composer's whole staged form, as `ComposeDetails` draws it:
              the kind under the name, and the pair the citation signs. An edit
              stages the same citation a first draft does, so it shows back the
              same facts. */}
          <StagedReference
            kind="post"
            name="The long way home — @ada"
            sub="Post"
            src="post-photo.jpg"
            pair={{ pDirected: 0.1, pInterest: 0.1 }}
            onEdit={() => {}}
          />
          <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
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

        <div style={{ flex: 1 }} />

        <ActsFooter count={unchanged ? 0 : 3} />
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
   designs. */
function CommentComposerFoot() {
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 0", borderTop: "1px solid var(--border-hairline)" }}>
      <MonogramAvatar name="Sol Ferreira" />
      <div style={{ flex: 1 }}>
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

function CommentsSheet({ children, scrolledBy = 0 }) {
  return (
    <BottomSheet open tallest ariaLabel="Comments">
      <SheetTitle>Comments</SheetTitle>
      <ul style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: COMMENTS_GAP, margin: 0, padding: "0 16px", listStyle: "none" }}>
        {scrolledBy > 0 && <li aria-hidden="true" style={{ flex: "none", height: 0, marginTop: -(scrolledBy + COMMENTS_GAP) }} />}
        {children}
      </ul>
      <CommentComposerFoot />
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
   left them. */
function CommentsThreadSheet({ landed = false, scrolledBy = 0 }) {
  const settledReply = (
    <ul style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", margin: 0, padding: 0 }}>
      <CommentCard
        depth={1}
        pending
        author={SOL}
        content="The third headland light is real — I have a print from 2019 that almost catches it. Almost."
        timestamp="now"
        onReply={() => {}}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={CARD_MENU}
      />
    </ul>
  );
  return (
    <CommentsSheet scrolledBy={scrolledBy}>
      <CommentCard
        author={TOBIAS}
        content="That stretch after the second bend is the reason I keep a camera in the glovebox."
        timestamp="1h"
        bundle={mkBundle(0.1, 0.1)}
        onReply={() => {}}
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
        timestamp="10m"
        media={[
          { src: "comment-shingle.jpg", ratio: "4 / 3", fit: "cover", alt: "A stretch of shingle at low tide." },
          { src: "comment-gulls.jpg", ratio: "1 / 1", fit: "cover", alt: "Gulls on the tideline." },
        ]}
        sensitive={{ reason: "A dead seabird in the second frame." }}
        onReply={() => {}}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={CARD_MENU}
      />
      <CommentCard
        author={SOL}
        content="Which headland is the third one, counting from the ferry landing?"
        timestamp="45m"
        onReply={() => {}}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={CARD_MENU}
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
   else. */
function SettingsBody() {
  return (
    <>
      <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
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
          footnote="Everything you sign is paid for separately. A post's license is settled when it is first signed and never changes."
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
          footnote="Your key signs everything you publish and lives only in this browser. Your recovery code is the only way back."
        >
          <SettingsRow label="Recovery code" status="Last created 12.08.2026" onOpen={() => {}} />
          <SettingsRow label="Your key" onOpen={() => {}} />
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
          <SettingsRow label="Email" value="sol@solferreira.art" onOpen={() => {}} />
        </SettingsGroup>

        {/* ABOUT SITS AFTER CREDENTIALS AND BEFORE LEAVING (jakob's ruling, the
            batch-rulings round). The page's order is frequency, not taxonomy,
            and these four rows are the least-reached on it — nobody opens
            settings to re-watch an intro. They stand together because they are
            one kind of row: four doors onto words about the product, none of
            them a setting.

            NO FOOTNOTE. A group's footnote carries the fact a reader needs once
            and never again, and there is none here — every row's label already
            says exactly what it opens.

            PRIVACY AND TERMS ARE ROWS AND NOTHING ELSE. They open static legal
            documents, which are written rather than designed; a board drawing
            one would be a drawing of text nobody in this repo writes. */}
        <SettingsGroup label="About">
          <SettingsRow label="Watch the intro again" onOpen={() => {}} />
          <SettingsRow label="About CoGra" onOpen={() => {}} />
          <SettingsRow label="Privacy" onOpen={() => {}} />
          <SettingsRow label="Terms" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup ariaLabel="Sign out">
          <SettingsRow
            checked={false}
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
            press; this opens a surface, and the chevron is the system's one
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
          footnote="Nothing is deleted here. The next screen says what goes and what stays, and the deletion is confirmed by a link we email you."
        >
          <SettingsRow label="Delete account" onOpen={() => {}} />
        </SettingsGroup>
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
   as the Post score itself has none (readme §13, geek mode). The pairs on these
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

/* ScoreOrigin — THE POST THE SCORE BELONGS TO, carried on all four levels so a
   reader four taps deep never loses what they are reading about.

   IT IS `QuotedRow`, which is the master for exactly this: the thing a surface
   is about, held above it, contained and inert. Inert is right here for the
   master's own reason — the reader came from that post and the back arrow is
   the way to it, so a second door would be a second answer to one question.

   THE SCORE UNDER IT IS PLAIN TEXT, NEVER `ExplainableNumber`. That master is
   the affordance and never the explanation; here the reader is standing inside
   the explanation, so a control that opened it again would open nothing. It
   keeps the master's own register — the label quiet, the value on-surface at
   500 — because it is the same figure, read rather than pressed. */
function ScoreOrigin({ score = "15.20" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <QuotedRow
        title="The long way home — @ada"
        snippet="Took the coast road instead of the tunnel. Four hours longer, worth every minute."
        name={ADA.displayName}
        src="comment-camera.jpg"
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          color: "var(--text-secondary)",
        }}
      >
        Post score
        <span style={{ color: "var(--on-surface)", fontWeight: 500 }}>{score}</span>
      </span>
    </div>
  );
}

/* PathTrace — A PATH'S SHAPE, drawn as the thing it is: the people it runs
   through, in order, from you to the post. This is the round's one new drawing
   and the reason it exists: a path is a connection between people, and every
   other way of showing one — a bar, a share of a total, a percentage — turns it
   into a statistic about the post instead of a fact about the reader's own
   network.

   IT ENDS ON THE POST, as a tile rather than a circle: people are circles
   everywhere in this system (`NodeMark`), and a post is a thing with a face.

   THE AVATARS ARE `aria-hidden` BY THE MASTER, so the trace carries its own
   screen-reader line — the same discipline every stance readout takes. */
function PathTrace({ people, size = 24 }) {
  const spoken = `You, then ${people.slice(1).map((p) => `@${p.handle}`).join(", then ")}, then the post`;
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
      <img
        src="post-photo.jpg"
        alt=""
        style={{ width: size, height: size, flex: "none", borderRadius: "var(--radius-extra-small)", objectFit: "cover", display: "block" }}
      />
      <span style={SR_ONLY}>{spoken}</span>
    </span>
  );
}

/* One path on the list — `ContentRow`'s geometry, with the trace where the disc
   would be. It is not `ContentRow` itself: that master's leading slot holds ONE
   40px disc, and a path is a chain. Everything else about the row is the
   master's — the card ground, the medium corner, the 12px padding, the chevron
   that says this opens another surface. */
function PathRow({ people, through, value, onOpen }) {
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
        <PathTrace people={people} />
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
   only in the name they hand it and whether anything is held. */
function TopicStanceRow({ name, bundle, stanceOpen, stanceDefaultPick }) {
  return (
    <div style={{ padding: "4px 16px 8px" }}>
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
   while it is open, under the wash, where it could not be pressed anyway. */
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
