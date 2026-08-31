/* Describe this picture (media slice): alt text, written where the words
   live — over the details step, never on crop. The sheet is the master
   DescribeSheet; its "?" is the copy-voice "Describing pictures" dialog. */
export function Screen() {
  return (
    <>
      <PageHeader title="Details" backHref="#" backLabel="Back" />
      <div style={{ padding: "12px 24px 0" }}>
        <PickedRow
          items={[{ src: "post-photo.jpg" }, { src: "gallery-market.jpg" }, { src: "gallery-honey.jpg" }]}
          caption="3 pictures — the body"
          onManage={() => {}}
        />
      </div>
      <div style={{ flex: 1 }} />

      <DescribeSheet
        open
        src="gallery-market.jpg"
        value="Crates of strawberries on the stand by the sea wall."
        onClose={() => {}}
      />
    </>
  );
}
