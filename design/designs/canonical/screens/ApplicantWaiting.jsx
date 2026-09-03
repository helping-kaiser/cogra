/* Applicant days, everything done — waiting on the inviter's approval. */
export function Screen() {
  return (
    <>
      <CograBand>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view while your application lands." />
      </CograBand>
      <FeedList>
        <TaskCard title="All set — waiting on your inviter" body="@mira's approval brings you in. Nothing else is needed from you." />
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <Snackbar message="Your post is staged — it lands with you." />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
