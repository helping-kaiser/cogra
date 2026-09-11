/* Prepended to every screen by render-screens.mjs. Screen-level helpers only —
   anything reusable across PRODUCTS belongs in components/, not here. */

const {
  PostCard,
  CommentCard,
  OverflowMenu,
  ReferenceRow,
  CograBand,
  BottomNav,
  ALL_SLOTS,
  PageHeader,
  BorrowedViewBand,
  MonogramAvatar,
  ActorChip,
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
  StanceReadout,
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

/* A standing of one gentle record — the vouch-back default made a bundle. */
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
   same menu on every content (readme §13). */
const CITE_ROW = { label: "Cite in a new post", onSelect: () => {} };
const CITE_MENU = [CITE_ROW];

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
  license: { attribution: 1, provenance: 0 },
  menuItems: CITE_MENU,
};

const TOBIAS_POST = {
  author: TOBIAS,
  content: "Low tide at six tomorrow — anyone walking the flats?",
  timestamp: "1h",
  score: "3.10",
  comments: 1,
  license: { attribution: 0, provenance: 0 },
  menuItems: CITE_MENU,
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
  license: { attribution: 0.5, provenance: 0.5 },
  menuItems: CITE_MENU,
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
  license: { attribution: 0, provenance: 0 },
  menuItems: CITE_MENU,
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

/* An application step riding the feed as a card (readme §13, entry). */
function TaskCard({ title, body, children }) {
  return (
    <Card style={{ flex: "none" }}>
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
          Everything you publish is signed with a key that is created on this device and stays in your hands — CoGra never
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

   ONE MECHANISM, SPELLED TWICE. A card mounts its own menu and prepends the
   license row to whatever `menuItems` it was handed; a DETAIL surface hides the
   card's dot and the header carries the menu instead, so these lists are that
   same menu written out for the header, and they take the row's words from the
   master's atom rather than spelling them again. The reader's menu keeps the
   card's own order, the license row first; the author's leads with the acts it
   was opened for and lets the license row close it. */
const LICENSE_ROW = { label: LICENSE_MENU_LABEL, onSelect: () => {} };
const OWN_POST_MENU = [
  { label: "Edit", onSelect: () => {} },
  { label: "Mark as sensitive", onSelect: () => {} },
  { label: "Remove", onSelect: () => {} },
  LICENSE_ROW,
];
const READER_POST_MENU = [LICENSE_ROW, CITE_ROW];
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
   word for referencing a person is mentioning (readme §13, the menus round). */
const PROFILE_MENU = [
  { label: "Mention in a new post", onSelect: () => {} },
  { label: "Share this profile", onSelect: () => {} },
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

/* The Sky, teased — token colours only: item 16's galaxy, hinted. */
function SkyField({ height = 180 }) {
  return (
    <Raw
      style={{ display: "block", lineHeight: 0 }}
      html={`<svg viewBox="0 0 358 ${height}" width="100%" height="${height}" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <line x1="40" y1="${height * 0.55}" x2="140" y2="${height * 0.3}" stroke="var(--border-hairline)" stroke-width="1"/>
        <line x1="140" y1="${height * 0.3}" x2="230" y2="${height * 0.62}" stroke="var(--border-hairline)" stroke-width="1"/>
        <line x1="230" y1="${height * 0.62}" x2="318" y2="${height * 0.38}" stroke="var(--border-hairline)" stroke-width="1"/>
        <line x1="140" y1="${height * 0.3}" x2="196" y2="${height * 0.14}" stroke="var(--border-hairline)" stroke-width="1"/>
        <circle cx="40" cy="${height * 0.55}" r="7" fill="var(--secondary-container)"/>
        <circle cx="140" cy="${height * 0.3}" r="12" fill="var(--primary)"/>
        <circle cx="196" cy="${height * 0.14}" r="4" fill="var(--outline)"/>
        <circle cx="230" cy="${height * 0.62}" r="9" fill="var(--primary-container)"/>
        <circle cx="318" cy="${height * 0.38}" r="6" fill="var(--secondary-container)"/>
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

/* The own-profile band cluster (profile round): the share control and the gear
   on the band's edge — chats arrives built into the band itself. Shared by the
   member and applicant own-profile boards.

   YOUR OWN PROFILE HAS NO MENU (readme §13, the menus round). Another person's
   holds two rows; on your own, mentioning yourself is not a thing anyone does,
   and share is what is left. A ⋮ that opens a sheet holding one row is a tap
   spent on nothing — so the band wears the share glyph the action rows already
   use, and one tap hands the profile to the platform's own sheet. */
function ProfileBandIcon({ name, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="cg-state cg-focus"
      style={{ display: "grid", placeItems: "center", height: "var(--touch-target-min)", width: "var(--touch-target-min)", border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
    >
      <Icon name={name} />
    </button>
  );
}
function ProfileBand({ children }) {
  return (
    <CograBand
      trailing={
        <span style={{ display: "flex", alignItems: "center" }}>
          <ProfileBandIcon name="share" label="Share your profile" />
          <ProfileBandIcon name="settings" label="Settings" />
        </span>
      }
    >
      {children}
    </CograBand>
  );
}

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

/* Someone else's profile, whole — shared the moment its own overflow menu
   needed the same page with a sheet over it (readme §13, the menus round). */
function ProfileOtherBody() {
  return (
    <>
      <PageHeader
        title="@ada"
        backHref="#"
        backLabel="Back"
        action={<OverflowMenu ariaLabel="More about @ada" items={PROFILE_MENU} />}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="ada"
            displayName="Ada Okonkwo"
            avatarSrc="ava1.jpg"
            bio="A dozen tries at the third headland light and counting."
            posts={12}
            stancesOn={48}
            stancesTaken={31}
            onCounts={() => {}}
            onCommit={() => {}}
            onMessage={() => {}}
            showHandle={false}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="everything" tabs={CHRONICLE_TABS} />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="2h" second="The long way home — the light does something at the third headland." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="chat_bubble" title="Commented" trailing="1d" second="The glovebox camera earns its keep — this is the print from 2019." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.6, pInterest: 0.3 }} title="Took a stance" titleAside="on @tobias" trailing="2d" inert />
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="5d" second="Took the coast road instead of the tunnel. Four hours longer, worth every minute." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="person" title="Updated their profile" trailing="7d" inert />
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
          src="ava1.jpg"
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

/* THE REPLY SEAL'S ADD-ROWS — a primary word where a value would sit, so what
   you could still add lines up with what you have already added. They are
   `ActsCard`'s action rows: the whole row is the control, because a word whose
   only slot clips its overflow is a word whose 48px target is cut back to the
   ink. Truncation belongs to the value slot, and an action row has none.

   They live here because BOTH reply seals draw them — the bare one and the one
   with a reference staged are one surface in two states, and a row spelled
   twice is a row that drifts. */
const ADD_ROWS = [
  { label: "", action: "+ Add a tag", count: "1 more action" },
  { label: "", action: "+ Cite something", count: "1 more action" },
];

/* ── WHAT AN OVERLAY SITS ON (jakob's ruling, 2026-09-08) ──────────────────
   A sheet, a dialog or a wash covers the surface the reader came from, and
   that surface is the real one — not a shortened stand-in of it. An overlay
   board therefore draws the board beneath it whole, and each of those bodies
   is written once here for the `KeyPledge` reason: a body on a second board
   stops being board-local, and three sketches of one seal are three chances
   to disagree about it.

   The bodies stay inert under their overlay — the boards say so in their
   `scanExempt` lines — so nothing here is wired; it is drawn. */

/* THE POST'S SEAL, whole — `ComposeSeal` itself, and what the stance pad, the
   license sheet, the sensitive sheet and the "?" dialog stand on. */
function ComposeSealBody() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="Signed actions" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Salt maps of the coast road", count: "1 action" },
            {
              label: "Tags",
              value: (
                <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                  <Chip label="#fieldnotes" tone="readout" />
                  <Chip label="#coastroad" tone="readout" />
                </span>
              ),
              count: "2 actions",
            },
            {
              label: "References",
              /* The staged citation carries the stance that rides with it, so
                 the row is two lines: what is cited, and what signing it says
                 about the citer. */
              value: (
                <span style={{ display: "flex", flexDirection: "column", padding: "6px 0", minWidth: 0 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>The long way home — @ada</span>
                  <StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />
                </span>
              ),
              count: "1 action",
            },
          ]}
          total="4 signed actions"
          note="they land together, or none does"
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value="Public domain — your default" action="Change" />
          <FactRow
            label="Where you stand on it"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
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

/* THE REPLY'S SEAL, whole — `ReplySeal` itself, and what the reply's stance pad
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
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-wash, rgba(0, 0, 0, 0.5))" }} />

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
          <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
            Nice, For or against +0.10, How much reaches you +0.10
          </span>
        </div>

        <div role="group" aria-label="Stance pad for the post you answer" style={{ alignSelf: "center", width: 240 }}>
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

function ReplySealBody() {
  return (
    <>
      <WizardHeader
        title="What you sign"
        leaveLabel="Leave — the reply is discarded"
        stageLabel="Last step"
        help="Signed actions"
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Reply to "The long way home" — 89 characters.</QuietNote>

        {/* One act signed, so no all-or-nothing subline: it appears the moment a
            signature carries more than one thing (`ActsCard`'s rule). */}
        <ActsCard
          rows={[
            { label: "Comment", value: "Reply to @ada's post", count: "1 action" },
            ...ADD_ROWS,
          ]}
          total="1 signed action"
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

        {/* The stance the reply carries is a fact about replying, not about
            this row — so it stands under the ruled block rather than inside
            it, where `FactRow` has no slot for it. */}
        <QuietNote>Replying also signs where you stand on the post it answers.</QuietNote>

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
   The caret rides the last paragraph wherever the box is drawn. */
function WordsBody({ paragraphs }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 12,
        borderRadius: "var(--radius-extra-small)",
        border: "1px solid var(--border-field)",
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
  );
}

/* THE PICTURE PATH'S DETAILS STAGE, whole — `ComposeDetails` itself, and what
   the reference pair sheet stands on. Factored for `ReplySealBody`'s reason: a
   sheet covers the surface the reader came from, and that surface has to be the
   real one, so the two boards share one markup. */
function ComposeDetailsBody() {
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

        <TextField label="Title" corner="Optional" value="Salt maps of the coast road" />

        <TextField label="Description" corner="Optional" rows={3} value="Rubbings from three weekends at low tide — paper against the salt crust." />

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

        <Button style={{ width: "100%" }}>Next</Button>
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
function EditComposeBody() {
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

        <TextField label="Title" corner="Optional" value="Salt maps of the coast road" />

        <TextField
          label="Description"
          corner="Optional"
          rows={2}
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

        <ActsFooter count={3} />
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}

/* The comment sheet's composer foot: your face, and the field that opens a
   comment. Every sheet of comments carries it, so it is written once. */
function CommentComposerFoot() {
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 0", borderTop: "1px solid var(--border-hairline)" }}>
      <MonogramAvatar name="Sol Ferreira" />
      <div style={{ flex: 1 }}>
        <TextField label="Add a comment" value="" />
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
function CommentsSheet({ children }) {
  return (
    <BottomSheet open ariaLabel="Comments" height="calc(100% - 72px)">
      <SheetTitle>Comments</SheetTitle>
      <ul style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, margin: 0, padding: "0 16px", listStyle: "none" }}>
        {children}
      </ul>
      <CommentComposerFoot />
    </BottomSheet>
  );
}

function CommentsThreadSheet() {
  return (
    <CommentsSheet>
      <CommentCard
        author={TOBIAS}
        content="That stretch after the second bend is the reason I keep a camera in the glovebox."
        timestamp="1h"
        bundle={mkBundle(0.1, 0.1)}
        onReply={() => {}}
        replyCount={2}
        onOpenReplies={() => {}}
        topics={["glovebox", "coastroad"]}
        references={1}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={CITE_MENU}
      />
      {/* The veiled comment sits SECOND, where the frame still shows it
          whole: the thread is taller than the sheet, and a state drawn
          below the fold is a state nobody can check. The whole body — the
          words and the two pictures with them — is under one
          comment-scale block, while the author, the timestamp and the
          stance stay readable. */}
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
        menuItems={CITE_MENU}
      />
      <CommentCard
        author={SOL}
        content="Which headland is the third one, counting from the ferry landing?"
        timestamp="45m"
        onReply={() => {}}
        license={{ attribution: 0, provenance: 0 }}
        menuItems={CITE_MENU}
        replies={[
          {
            id: "r1",
            author: ADA,
            content: "The one past the pines — the road dips right before it.",
            timestamp: "40m",
            onReply: () => {},
            license: { attribution: 0, provenance: 0 },
            menuItems: CITE_MENU,
          },
          {
            id: "r2",
            author: TOBIAS,
            content: "@ada That dip floods at spring tide, mind the sign.",
            timestamp: "22m",
            onReply: () => {},
            license: { attribution: 0, provenance: 0 },
            menuItems: CITE_MENU,
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
  license: { attribution: 0, provenance: 0 },
  menuItems: CITE_MENU,
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
  poster: "clip-canoe.jpg",
  ratio: "landscape",
  alt: "Two canoes crossing a mountain lake.",
};

const CLIP_GRAPES = {
  kind: "video",
  src: "clip-grapes.mp4",
  poster: "clip-grapes.jpg",
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
  menuItems: CITE_MENU,
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
  menuItems: CITE_MENU,
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
          label="Taking a stance"
          footnote="A tap opens this, everywhere. Press and hold instead, and a small positive one is signed on the spot."
        >
          <SettingsRow
            name="settings-stance-input"
            selected
            label="The pad"
            status="A tap opens it; drift to where you stand."
          />
          <SettingsRow
            name="settings-stance-input"
            selected={false}
            label="Sliders"
            status="One slider per side of the stance."
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
            default: the faces, the tag objects and the `graph` mark carry every
            signal number until a reader asks for the digits. */}
        <SettingsGroup
          label="Reading"
          footnote="Every feed starts from what it shows, and a change made inside a feed lasts until you change it back. Both choices stay on this device."
        >
          <SettingsRow label="What your feed shows" value="Posts" onOpen={() => {}} />
          <SettingsRow
            checked={false}
            label="Show exact values"
            status="The numbers behind the faces and the glyphs."
            onOpen={() => {}}
          />
        </SettingsGroup>

        <SettingsGroup
          label="Key backup"
          footnote="Your key signs everything you publish and lives only in this browser. Your recovery code is the only way back."
        >
          <SettingsRow label="Recovery code" status="Last created 12 August" onOpen={() => {}} />
          <SettingsRow label="Your key" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Sessions"
          footnote="A device you sign out can stay signed in for up to 15 minutes."
        >
          <SettingsRow label="Firefox on Ubuntu" status="This browser" inert />
          <SettingsRow
            label="Pixel 8"
            status="Last used 2 days ago"
            inert
            trailing={<InlineAction onClick={() => {}}>Revoke</InlineAction>}
          />
          <SettingsRow
            label="Unnamed device"
            status="Last used 12 August"
            inert
            trailing={<InlineAction onClick={() => {}}>Revoke</InlineAction>}
          />
          <SettingsRow action label="Sign out everywhere else" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Credentials"
          footnote="Changing your password signs out every other device."
        >
          <SettingsRow label="Password" status="Changed 3 weeks ago" onOpen={() => {}} />
          <SettingsRow label="Handle" value="@sol" onOpen={() => {}} />
          <SettingsRow label="Email" value="sol@solferreira.art" onOpen={() => {}} />
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
      </div>
    </>
  );
}

