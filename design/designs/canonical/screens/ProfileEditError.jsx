/* Edit profile · an empty name — the input-error round (readme §13,
   profile round): Display name wears M3's error state on Save, the one
   field the profile task flow requires. */
export function Screen() {
  return (
    <>
      <PageHeader title="Edit profile" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MonogramAvatar name="Sol Ferreira" size={64} />
          <Button variant="outline" size="sm">Change picture</Button>
        </div>
        <TextField label="Display name" value="" error="A display name can't be empty." />
        <TextField label="Bio" corner="Optional" rows={3} value="Field notes from the flats — salt, paper, and whatever the wind allows." />
        <TextField label="Website" corner="Optional" value="solferreira.art" />
        <QuietNote>Your handle changes in Settings.</QuietNote>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Save</Button>
      </div>
    </>
  );
}
