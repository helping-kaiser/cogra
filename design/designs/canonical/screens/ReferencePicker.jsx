/* Citing — the reference explorer, wearing the search UI (readme §13): the
   same bar, the same worded trigger, the same rows. No Sky entry — citing is a
   task, not the tab. The rows' edge is the ADD mark: the whole row's tap picks
   the reference; ranking still orders the list.

   IT OFFERS POSTS, COMMENTS AND PROFILES (readme §13, the V1.0 scope cut,
   2026-09-25): a V1.0 reference points at a person, a post or a comment — the
   contract's `ReferenceTarget` union, read as the ruling — so no row offers a
   kind that cannot be cited, and its filter holds those three kinds. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Cite something" action={<HelpDot />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="salt" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <FilterTrigger reading="Everything" ariaLabel="What the search shows" />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" sub="@sol · 3d" src="post-photo.jpg" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="person" name="Sal Torres" sub="@saltorres" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
      </div>
    </>
  );
}
