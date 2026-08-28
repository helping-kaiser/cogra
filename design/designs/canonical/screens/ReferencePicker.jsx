/* Citing — the reference explorer, wearing the search UI (readme §13): the
   same bar, the same worded trigger, the same rows. No Sky entry — citing is a
   task, not the tab. The rows' edge is the ADD mark: the whole row's tap picks
   the reference; ranking still orders the list. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Cite something" action={<HelpDot />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="salt" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <SearchFilterTrigger reading="All kinds · ranked" />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" sub="@sol · 3d" src="post-photo.jpg" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="person" name="Sal Torres" sub="@saltorres" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="item" name="Salt cellar, hand-carved" sub="offered by @tobias" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="proposal" name="Keep the salt flats path open" sub="open for votes" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="chat" name="Salt marsh survey crew" sub="12 people" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="campaign" name="Sea salt collective — autumn run" sub="by @seasaltco" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="offer" name="Offer on Salt cellar, hand-carved" sub="by @ada" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <div style={{ flex: 1 }} />
        <p style={{ margin: 0, padding: "8px 24px 16px", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
          @handle and #topic reach comments and messages too.
        </p>
      </div>
    </>
  );
}
