/* The details step mid-upload (media slice): rings on the thumbnails, one
   failure with its words and ways out, the describe counter — and no Crop or
   Edit links anywhere: the row IS the affordance and opens Show all; the crop
   step is one Back away (jakob 2026-08-31, "none"). */

export function Screen() {
  return (
    <>
      <WizardHeader title="Details" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <PickedRow
          items={[
            { src: "post-photo.jpg" },
            { src: "gallery-market.jpg", progress: 0.65 },
            { src: "gallery-honey.jpg", failed: true },
          ]}
          caption="3 pictures — the body"
          onManage={() => {}}
        />
        <UploadErrorLine onRetry={() => {}} onRemove={() => {}} />
        <DescribeCounter described={1} total={3} onDescribe={() => {}} />

        <TextField label="Title" corner="Optional" value="Sunday at the tide market" />
        <TextField label="Description" corner="Optional" rows={2} value="Everything the flats give up in one morning." />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TopicRemovable topic="tidemarket" />
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)", textAlign: "center" }}>
          Pictures upload while you write — signing waits for them.
        </p>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
