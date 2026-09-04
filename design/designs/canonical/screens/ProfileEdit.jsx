/* Edit profile — the task flow off one's own header (profile round, item 23).
   Back arrow, no bar (a task flow, Q37). The picture keeps its own row here —
   the same crop-and-seal flow the header badge reaches (jakob 2026-09-01: the
   avatar is the frequent standalone change; the rare name/bio/website edits
   live here). Save sits at the bottom (the wizard ruling) and leads to the
   change's seal: every profile change is a signed act. The handle is
   deliberately absent — it is L2 account state and changes in Settings. */
export function Screen() {
  return (
    <>
      <PageHeader title="Edit profile" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MonogramAvatar name="Sol Ferreira" size={64} />
          <Button variant="outline" size="sm">Change picture</Button>
        </div>
        <TextField label="Display name" value="Sol Ferreira" />
        <TextField label="Bio" corner="Optional" rows={3} value="Field notes from the flats — salt, paper, and whatever the wind allows." />
        <TextField label="Website" corner="Optional" value="solferreira.art" />
        <QuietNote>Your handle changes in Settings.</QuietNote>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Save</Button>
      </div>
    </>
  );
}
