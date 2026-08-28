/* Prepended to every search-ideation screen by render-screens.mjs
   (`node render-screens.mjs designs/search`). Screen-level helpers only —
   anything reusable across PRODUCTS belongs in components/. The SearchBar and
   the orbit visual live here until a direction is chosen; the winner's pieces
   port into the system at the canonical build. */

const {
  CograBand,
  BottomNav,
  ALL_SLOTS,
  ReferenceRow,
  Chip,
  SegmentedFilter,
  Card,
  Button,
  Icon,
} = components;

/* The search field — M3's search-bar idiom (a full pill, leading glyph,
   placeholder register). THE `TextField` SEARCH VARIANT THIS ITEM OWES: drawn
   here as a helper, ported into forms/ once a direction wins. */
function SearchBar({ query, placeholder = "Search" }) {
  return (
    <div style={{ padding: "4px 16px 12px 16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 48,
          padding: "0 16px",
          borderRadius: "var(--radius-full)",
          background: "var(--surface-container-high)",
          color: query ? "var(--on-surface)" : "var(--text-secondary)",
          boxSizing: "border-box",
        }}
      >
        <span style={{ display: "inline-flex", color: "var(--text-secondary)" }}>
          <Icon name="search" size={20} />
        </span>
        <span style={{ fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {query || placeholder}
        </span>
        {query && (
          <span aria-hidden="true" style={{ marginLeft: "auto", width: 2, height: 22, background: "var(--primary)", flex: "none" }} />
        )}
      </div>
    </div>
  );
}

/* A device-local recent query — a quiet row, never a record. */
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

/* The orbit visual — token colours only: dots of primary and containers on the
   container surface, a few hairline paths. A teaser of item 16's galaxy. */
function OrbitField({ height = 180 }) {
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

/* The order controls: the swap plus the seen toggle, one row — the same
   section the feed's filter grows (backlog item 19). */
function OrderRow({ order = "ranked", hideSeen = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px 8px 16px" }}>
      <SegmentedFilter
        ariaLabel="Order"
        options={[
          { value: "ranked", label: "Ranked" },
          { value: "newest", label: "Newest" },
        ]}
        value={order}
      />
      <Chip label="Hide seen" selected={hideSeen} />
    </div>
  );
}

/* The kinds row — every searchable kind, one scrollable line of chips. */
const KINDS = ["All", "People", "Posts", "Comments", "Topics", "Items", "Chats", "Messages", "Proposals", "Campaigns", "Offers"];
function KindsRow({ active = "All" }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "0 16px 8px 16px", overflow: "hidden", flexWrap: "nowrap" }}>
      {KINDS.map((kind) => (
        <Chip key={kind} label={kind} selected={kind === active} />
      ))}
    </div>
  );
}

/* The seam — where the ranked list ends and the newest tail begins. */
function Seam() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 24px" }}>
      <span style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
      <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", color: "var(--text-secondary)" }}>
        Beyond your graph — newest first
      </span>
      <span style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
    </div>
  );
}

/* A quiet section caption (recents, sectioned results). */
function SectionLabel({ children }) {
  return (
    <span style={{ display: "block", padding: "12px 24px 4px", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

/* The scrolling middle of the tab. */
function Column({ children }) {
  return <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>{children}</div>;
}
