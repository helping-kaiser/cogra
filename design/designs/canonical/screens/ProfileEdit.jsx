/* Edit profile — the task flow off one's own header (profile round, item 23).
   Back arrow, no bar (a task flow, Q37). The picture keeps its own row here —
   the same crop-and-seal flow the header badge reaches (jakob 2026-09-01: the
   avatar is the frequent standalone change; the rare name/bio/website edits
   live here). Save sits at the bottom (the wizard ruling) and leads to the
   change's seal: every profile change is a signed act. The handle is
   deliberately absent — it is L2 account state and changes in Settings.
   It reads as a wizard stage, not a task page (jakob 2026-10-01): it leads
   to a seal, so `Save` keeps its pinned foot under the two-placement law. */
/* REGISTERED under the `profileEdit` prefix (round 48, seam 323-11 and 323-6), the credential forms' grammar: `header`, the picture's door `picture`, the fields `name`, `bio` and `website` (one-word names, so the sidecar's quoted strings never spell a node), and the commit `save`. Names only: not a pixel moves. */
export const NODE = "profileEdit";
export function Screen() {
  return (
    <>
      <PageHeader title="Edit profile" backHref="#" backLabel="Back" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MonogramAvatar name="Sol Ferreira" size={64} />
          <Button variant="outline" size="sm" node="picture">Change picture</Button>
        </div>
        <TextField node="name" label="Display name" corner="Optional" kind="name" cap={50} value="Sol Ferreira" />
        <TextField node="bio" label="Bio" corner="Optional" rows={3} cap={500} value="Field notes from the flats — salt, paper, and whatever the wind allows." />
        <TextField node="website" label="Website" corner="Optional" kind="url" autoComplete="url" enterKeyHint="go" cap={2048} value="solferreira.art" />
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }} node="save">Save</Button>
      </div>
    </>
  );
}
