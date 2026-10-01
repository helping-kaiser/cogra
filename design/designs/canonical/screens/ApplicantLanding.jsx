/* APPROVED, AND THE REGISTRATION STILL LANDING (jakob 2026-10-01, the
   applicant's life round). Between @mira's approval and the record landing,
   the reader's device runs the registration's signing handshake on its next
   open, and the record then takes its moment to confirm (auth.md, *Approval
   and landing*; web.md's loop calls the state "landing awaited"). The copy
   existed with no board: `Your registration is landing`.

   IT IS `ApplicantWaiting`'S BOARD WITH THE CARD FLIPPED, the way
   `ApplicantRejected` is — the same band, the same borrowed feed, the same
   bar, numbered to the number. The card names something a machine is doing,
   so it carries NO CONTROL: nothing the reader taps changes it, and a button
   would claim otherwise. The moment the record lands the card flips live to
   `VouchBack`'s vouch card, where the reader is standing — no reload, no tap.

   THE KEY-ABSENT VARIANT (the `keyAt` chip). The handshake needs the key, so
   with the key on another device the landing waits for that device's next
   open — indefinitely, if the reader never opens it. The card says so, once,
   instead of promising a moment that will not come here. Whether it should
   also offer the key's restore is filed, not drawn. */
export const PROPS = { keyAt: { editor: "enum", options: ["here", "elsewhere"], default: "here" } };
export const VALS = `landingBody: this.props.keyAt === "elsewhere" ? "Your key was made on another device, and it lands from there — open CoGra on that device." : "@mira approved your application. Nothing is needed from you while it lands."`;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view while your application lands." />
      </CograBand>
      <FeedList>
        <TaskCard title="Approved — your registration is landing" body="{{landingBody}}" />
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
