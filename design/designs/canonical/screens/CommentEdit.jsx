/* Edit comment (media slice): the post's one-screen-one-batch, scaled to the
   comment's anatomy — words, pictures (uncropped, four max), topics,
   citations, the license locked. Entered from Edit on an own comment. */

function FieldLabel({ children }) {
  return (
    <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", letterSpacing: "var(--text-label-large--letter-spacing)" }}>
      {children}
    </span>
  );
}

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit comment" action={<SystemHelpDot ariaLabel="Editing" />} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Your comment on "The long way home".
        </p>

        <TextField label="Words" rows={3} value="The glovebox camera earns its keep — this is the print from 2019 that almost catches it." />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Pictures</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" size={56} fit="contain" onRemove={() => {}} />
            <Button variant="text" size="sm">+ Add · 1 of 4</Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "4px 12px", borderRadius: "var(--radius-full)", background: "var(--secondary-container)", color: "var(--on-secondary-container)", fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", letterSpacing: "var(--text-label-large--letter-spacing)" }}>
              #glovebox
              <Icon name="close" size={16} />
            </span>
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <Button variant="text" size="sm" selfStart>+ Cite something</Button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderTop: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)" }}>
          <span style={{ flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>License</span>
          <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>Public domain</span>
          <span style={{ color: "var(--text-secondary)", display: "inline-flex" }} aria-label="The license never changes">
            <Icon name="lock" size={16} />
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          This creates 2 signed actions
          <span style={{ display: "inline-flex" }}>
            <Icon name="expand_more" size={16} />
          </span>
        </div>
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}
