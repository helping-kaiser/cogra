/* NEW GROUP CHAT · picking the people — the picker after `New group chat`
   (would-like #3; jakob 2026-09-23: New group chat → multi-pick → the
   founding).

   THE SAME LIST, NOW STAGING. The tag picker's grammar at person kind: each
   candidate row carries the add mark on its edge, and a tap stages the person
   rather than opening a chat. Whoever is staged stands above the list as a
   `StagedReference` row with its ×, the way a citation stands staged on a
   composer — a piece of what is being made, shown back to the one making it,
   and taken back out with one tap.

   `Next` CARRIES THE PICKED PEOPLE INTO THE FOUNDING (`ChatCreate`), where
   they are said back in one line and the seal counts them as invitations. The
   foot is `WizardFooter`'s: the list runs edge to edge, so the foot owns its
   own side padding. */
export function Screen() {
  return (
    <>
      <PageHeader title="New group chat" backHref="#" backLabel="Back to new chat" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search people" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px 8px" }}>
          <StagedReference kind="person" name="Ada Okonkwo" sub="@ada" onRemove={() => {}} />
          <StagedReference kind="person" name="Tobias Lindqvist" sub="@tobias" onRemove={() => {}} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <PeopleRows people={PICKER_PEOPLE.filter((p) => p.handle !== "ada" && p.handle !== "tobias")} add />
      </div>
      <WizardFooter label="Next" />
    </>
  );
}
