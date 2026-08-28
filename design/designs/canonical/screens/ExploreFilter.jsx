/* The search filter sheet — what the worded trigger opens: the kinds that
   combine, the one order that does not, and the seen toggle. The same Order
   section the feed's filter grows (backlog item 19). */
const KINDS = ["People", "Posts", "Comments", "Topics", "Items", "Chats", "Messages", "Proposals", "Campaigns", "Offers"];

function SheetSection({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: "var(--text-title-small, var(--text-title-medium))", fontWeight: "var(--text-title-medium--font-weight)", lineHeight: "var(--text-title-medium--line-height)" }}>{label}</span>
        {hint && <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="@sol salt" />
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 16px 8px 16px" }}>
          <SearchFilterTrigger reading="All kinds · ranked · showing seen" />
          <HelpDot />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" rank="9.10" onOpen={() => {}} />
        <ReferenceRow kind="item" name="Salt-crust rubbing, framed" rank="4.30" onOpen={() => {}} />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="What the search shows">
        <SheetTitle>What the search shows</SheetTitle>
        <SheetSection label="Kinds" hint="Combine as many as you like. All, until you narrow it.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {KINDS.map((kind) => (
              <Chip key={kind} label={kind} selected={false} />
            ))}
          </div>
        </SheetSection>
        <SheetSection label="Order" hint="Ranked follows your own graph. Newest ignores it.">
          <SegmentedFilter
            ariaLabel="Order"
            options={[
              { value: "ranked", label: "Ranked" },
              { value: "newest", label: "Newest" },
            ]}
            value="ranked"
          />
        </SheetSection>
        <SheetSection label="Seen">
          <Checkbox label="Show what you've already seen" checked />
        </SheetSection>
      </BottomSheet>
    </>
  );
}
