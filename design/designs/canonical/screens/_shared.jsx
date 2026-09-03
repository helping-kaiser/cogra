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
  SearchBar,
  Chip,
  SegmentedFilter,
  Checkbox,
  FeedFilter,
  FilterTrigger,
  FilterSection,
  OrderSection,
  FEED_KINDS,
  FEED_FILTER_DEFAULT,
  HelpDot: SystemHelpDot,
  MoneyFigure,
  CgtMark,
  MediaThumb,
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
  StanceValue,
  SensitiveVeil,
  SensitiveScope,
  RedactedContent,
  MediaDisc,
  VideoTransport,
  SeekLine,
  ShareButton,
  ExplainableNumber,
  MediaViewer,
} = components;

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

/* Genesis content always declares a licence, so every card has at least that
   menu entry — without one the dot vanishes, and it must not. Citing rides the
   same menu on every content (readme §13). */
const CITE_MENU = [{ label: "Cite in a new post", onSelect: () => {} }];

const ADA_POST = {
  author: ADA,
  title: "The long way home",
  content:
    "The light does something at the third headland that I have never managed to photograph properly, and I have tried maybe a dozen times now. This is the closest I have come.",
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
  content:
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
  content:
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

/* The dev-phase APK line riding the collapsing top (readme §13, entry). */
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

/* The detail surface's header: back plus the ONE overflow. On a detail view the
   menu lives up here and the card's own dot yields (PostCard hides it in
   detail) — two dots would be two menus for one post. */
function DetailHeader({ items }) {
  return <PageHeader backHref="#" backLabel="Back to feed" action={<OverflowMenu items={items} ariaLabel="More on this post" />} />;
}

/* What the one menu holds — the author's post vs someone else's. */
const OWN_POST_MENU = [
  { label: "Edit", onSelect: () => {} },
  { label: "Mark as sensitive", onSelect: () => {} },
  { label: "Remove", onSelect: () => {} },
  { label: "License terms", onSelect: () => {} },
];
const READER_POST_MENU = [
  { label: "Cite in a new post", onSelect: () => {} },
  { label: "License terms", onSelect: () => {} },
];

/* A quiet section caption (the references sheet's groups, Explore's recents,
   the sectioned surfaces). */
function SectionLabel({ children }) {
  return (
    <span
      style={{
        display: "block",
        padding: "12px 24px 4px",
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        fontWeight: "var(--text-label-small--font-weight)",
        letterSpacing: "var(--text-label-small--letter-spacing, 0.5px)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

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

/* The "?" — the master, defaulted to this canvas's usual label. */
function HelpDot({ ariaLabel = "How searching works" }) {
  return <SystemHelpDot ariaLabel={ariaLabel} />;
}

/* The own-profile band cluster (profile round): the overflow and the gear on
   the band's edge — chats arrives built into the band itself. Shared by the
   member and applicant own-profile boards. */
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
          <ProfileBandIcon name="more_vert" label="More — share your profile" />
          <ProfileBandIcon name="settings" label="Settings" />
        </span>
      }
    >
      {children}
    </CograBand>
  );
}

/* A person row on the stances page — the actor, and THE STANCE THE ROW IS
   ABOUT (jakob 2026-09-01): the record's own value, face and pair, read-only.
   Unlike a follow, a stance has sign and magnitude, so the value is the
   row's information; acting on the person means opening their profile first
   — the whole row does exactly that. */
function StanceRow({ name, handle, src, pDirected, pInterest }) {
  return (
    <button
      type="button"
      className="cg-state cg-focus"
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", minHeight: 56, border: 0, background: "none", padding: "6px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" }}
    >
      <MonogramAvatar name={name} size={40} src={src} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>{name}</span>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>@{handle}</span>
      </span>
      <StanceValue pDirected={pDirected} pInterest={pInterest} />
    </button>
  );
}

/* The chronicle's tab row (profile round, 2026-09-01): full-width icon tabs,
   the way every social profile draws this row — the segmented pill was ruled
   out at three options. Icon-only cells with accessible names; the selected
   tab speaks in primary AND a 2px underline. The underline is a deliberate
   deviation from "selection is colour only": an icon's colour alone is too
   quiet to carry which of three same-weight glyphs is on. Screen-local until
   it settles, then it graduates to components/. */
function ChronicleTabs({ value = "everything" }) {
  const TABS = [
    { id: "posts", icon: "dynamic_feed", label: "Posts" },
    { id: "comments", icon: "chat_bubble", label: "Comments" },
    { id: "everything", icon: "history", label: "Everything" },
  ];
  return (
    <div role="group" aria-label="What the chronicle shows" style={{ display: "flex", borderBottom: "1px solid var(--border-hairline)" }}>
      {TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={selected}
            aria-label={tab.label}
            className="cg-state cg-focus"
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              minHeight: "var(--touch-target-min)",
              border: 0,
              background: "none",
              padding: 0,
              cursor: "pointer",
              color: selected ? "var(--primary)" : "var(--text-secondary)",
              boxShadow: selected ? "inset 0 -2px 0 var(--primary)" : "none",
            }}
          >
            <Icon name={tab.icon} size={22} />
          </button>
        );
      })}
    </div>
  );
}

/* The profile's chronicle as CONTAINERS, the wallet history's anatomy (jakob
   2026-09-01 — "draw inspiration from there"): each act its own card on the
   surface-card ground, a leading 40px disc carrying the act's kind (a glyph,
   or the stance record's own face), the verb and its snippet, the time on the
   trailing edge, Still settling where an act pends. A card with somewhere to
   go is a button; a record with no destination is the same card, inert. */
function ChronicleCard({ glyph, face, label, context, snippet, time, pending = false, link = true }) {
  const disc = (
    <span
      style={{ width: 40, height: 40, borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)", display: "grid", placeItems: "center", flex: "none" }}
    >
      {face ? <StanceValue pDirected={face.pDirected} pInterest={face.pInterest} showPair={false} /> : <Icon name={glyph ?? "history"} size={20} />}
    </span>
  );
  const inner = (
    <>
      {disc}
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", letterSpacing: "var(--text-label-large--letter-spacing)" }}>{label}</span>
          {context && <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>{context}</span>}
        </span>
        {snippet && (
          <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{snippet}</span>
        )}
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>{time}</span>
        {pending && <PendingMarker />}
      </span>
    </>
  );
  const style = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    width: "100%",
    boxSizing: "border-box",
    border: 0,
    borderRadius: "var(--radius-medium)",
    background: "var(--surface-card)",
    padding: "var(--space-3)",
    fontFamily: "var(--font-sans)",
    color: "var(--on-surface)",
    textAlign: "left",
  };
  return link ? (
    <button type="button" className="cg-state cg-focus" style={{ ...style, cursor: "pointer" }}>
      {inner}
    </button>
  ) : (
    <div style={style}>{inner}</div>
  );
}

/* The chronicle column: cards on 8px of surface, the wallet history's seam. */
function ChronicleList({ children }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px 0" }}>
      {children}
    </div>
  );
}

/* A file the surface refused (comment video round, 2026-09-02): the tile wears
   MediaThumb's failed badge, the words sit beside it in UploadErrorLine, and
   the only way out is Remove it — retrying cannot make a file smaller or a
   format readable. The refusal is drawn where the file was offered, never in a
   dialog and never in a snackbar. A file nothing can read has no preview, so
   its tile is empty on purpose. Screen-local until a second product needs it. */
function RefusedFile({ src, alt = "", video = false, message }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <MediaThumb src={src} alt={alt} video={video} failed />
      <div style={{ flex: 1, minWidth: 0 }}>
        <UploadErrorLine message={message} onRemove={() => {}} />
      </div>
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

/* ── The stream (readme §13, the reel round) ──────────────────────────────
   Screen-local: one board draws the stream, so the rail lives here until a
   second surface needs it. Everything on it that is a design-system control
   IS the design-system control — the stance face, the score element — because
   the stream is the ordinary feed in a different frame, not a second product.

   THE STREAM IS A DARK SURFACE IN BOTH THEMES: it is a clip edge to edge, and
   its chrome has to read over photography whatever the reader's theme says. So
   the whole surface takes the dark palette (`data-theme="dark"`) rather than
   each control inventing a colour of its own. */

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
  content:
    "Stood there long enough that the midges found me. Worth it for the last ten seconds, when the far shore goes the colour of the water.",
  timestamp: "35m",
  media: [CLIP_LAKESIDE],
  topics: ["stillwater", "coastroad"],
  score: "7.40",
  comments: 2,
  license: { attribution: 0, provenance: 0 },
  menuItems: CITE_MENU,
};

/* The bottom bar's height — what the stream's own chrome has to clear. */
const BAND_HEIGHT = 64;

/* A rail control: a glyph over the clip, with its count under it where there is
   one. WHITE AND SHADOWED, at 28px (jakob, review round 1): a token colour on
   photography is not a quiet control but an invisible one, and the shadow is
   what makes a bare glyph survive a bright frame — the same problem the sound
   disc solves with a surface, answered differently because a column of five
   discs would be a wall of chrome down the frame. */
function RailButton({ label, glyph, count, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick ?? (() => {})}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: 56,
        border: 0,
        background: "none",
        borderRadius: "var(--radius-full)",
        padding: "6px 0",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        fontWeight: "var(--text-label-small--font-weight)",
        color: "#fff",
      }}
    >
      <Icon name={glyph} size={28} />
      {count !== undefined && <span aria-hidden="true">{count}</span>}
    </button>
  );
}

/* THE RAIL, top to bottom: author · stance · comments · share · the score.
   People lead, the way they lead on a card (§1) — the author is the one thing
   here that is not an act. Then the acts in the card's own order, with share
   arriving after them. THE SCORE SITS LAST because it is the door out of the
   stream: a thumb reaching for the stance never passes over the exit. Topics,
   the reference count and the reader's ⋮ are not here — they belong to the
   detail view, which the score opens. */
function ReelRail({ score = "7.40", comments = 2 }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 4,
        bottom: BAND_HEIGHT + 96,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        zIndex: 3,
        filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.55))",
      }}
    >
      <a href="/u/mira" aria-label="Mira Voss" style={{ display: "block", textDecoration: "none" }}>
        <MonogramAvatar name="Mira Voss" size={44} src="ava1.jpg" />
      </a>
      {/* The same control the card wears, and the same pad it blooms — over the
          paused clip, seal and all. No bundle: the ordinary case is a post the
          reader has taken no stance on, and over media that unset state wears
          the outlined disc, because a translucent grey face on a photograph is
          a control nobody can find. */}
      <StanceControl targetLabel="this post" padInset={BAND_HEIGHT + 16} overMedia />
      <RailButton label="2 comments" glyph="chat_bubble" count={comments} />
      <RailButton label="Share this post" glyph="share" />
      {/* THE DETAIL DOOR — the exact element a feed card wears, so the way into
          the post is a thing the reader has already met, and the number that
          says this stream is their own ranked feed rides it. */}
      <ExplainableNumber glyph="graph" label="Post Score" value={score} onOpenDetail={() => {}} overMedia />
    </div>
  );
}

/* The caption: the author's handle, the title, and the words clamped — the same
   two-line budget a card gives them, with the same opener. */
function ReelCaption({ handle, title, content }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        right: 76,
        bottom: BAND_HEIGHT + 22,
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        color: "var(--on-surface)",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      <span style={{ fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}>@{handle}</span>
      <span style={{ fontSize: "var(--text-title-small)", lineHeight: "var(--text-title-small--line-height)", fontWeight: "var(--text-title-small--font-weight)" }}>{title}</span>
      <span style={{ fontSize: "var(--text-body-small)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {content}
      </span>
      <button
        type="button"
        className="cg-state cg-focus"
        style={{
          alignSelf: "flex-start",
          border: 0,
          background: "none",
          padding: "2px 0",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-label-medium)",
          fontWeight: "var(--text-label-medium--font-weight)",
          color: "var(--on-surface)",
        }}
      >
        More
      </button>
    </div>
  );
}

/* The clip pinned at the top of a video post's detail view — what the squish
   morph leaves behind, and what the detail view of any clip looks like whether
   or not a stream was involved. It carries the transport, drawn revealed. */
function PinnedClip({ item, elapsed, duration, progress }) {
  return (
    <div style={{ flex: "none", background: "#000" }}>
      <MediaAttachment
        {...item}
        controls="transport"
        radius="0px"
        elapsed={elapsed}
        duration={duration}
        progress={progress}
      />
    </div>
  );
}
