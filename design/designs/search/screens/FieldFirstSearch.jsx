/* Direction 2 · Field first, searching — a #-scoped query. Instead of chip
   rows, ONE trigger reads the whole view back in words (the FeedFilter idiom,
   item 4) and opens a sheet; the row budget goes to results. The topic itself
   leads the ranked list. */
function FilterTrigger({ reading }) {
  return (
    <div style={{ padding: "0 16px 8px 16px" }}>
      <button
        type="button"
        className="cg-state cg-focus"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          minHeight: 40,
          padding: "0 16px",
          border: "1px solid var(--border-field)",
          borderRadius: "var(--radius-full)",
          background: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          color: "var(--text-secondary)",
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          textAlign: "left",
          boxSizing: "border-box",
        }}
      >
        {reading}
      </button>
    </div>
  );
}

export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="#saltmaps" />
      </div>
      <FilterTrigger reading="All kinds · ranked · showing seen" />
      <Column>
        <ReferenceRow kind="topic" name="saltmaps" value="12.40" onOpen={() => {}} />
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" value="9.10" onOpen={() => {}} />
        <ReferenceRow kind="post" name="Salt flats at first light" value="5.60" onOpen={() => {}} />
        <ReferenceRow kind="item" name="Salt-crust rubbing, framed" value="4.30" onOpen={() => {}} />
        <Seam />
        <ReferenceRow kind="post" name="Grain of the flats" value="3w" onOpen={() => {}} />
        <ReferenceRow kind="post" name="First try at a rubbing" value="06.09.2024" onOpen={() => {}} />
      </Column>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
