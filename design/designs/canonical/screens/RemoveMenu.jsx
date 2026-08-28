/* An own post's menu — the bottom sheet with the rare interactions. */
export function Screen() {
  return (
    <>
      <PageHeader backLabel="Back to feed" />
      <DetailColumn>
        <PostCard {...SOL_POST} variant="detail" bundle={mkBundle(0.1, 1)} />
      </DetailColumn>
      <BottomSheet open ariaLabel="Post actions">
        <SheetItem label="Edit" />
        <SheetItem label="Mark as sensitive" />
        <SheetItem label="Remove" />
        <SheetItem label="License terms" />
      </BottomSheet>
    </>
  );
}
