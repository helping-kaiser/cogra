/* Applicant days, first steps — the application rides the feed as cards. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view while your application lands." />
      </CograBand>
      <FeedList>
        <TaskCard title="Verify your email" body="We sent you a verification link — open it to prove this email is yours.">
          <Button variant="outline" selfStart>
            Resend the link
          </Button>
        </TaskCard>
        <TaskCard title="Create your key" body="Your application needs a key on this device before @mira can approve it.">
          <Button selfStart>Create my key</Button>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
