/* HISTORY, A HIDDEN PERSON'S PROFILE CARD, ITS MENU OPEN (round 41; jakob
   2026-11-11, M1: "the unhide should be visible whenever we land on a card of
   a hidden account"; backlog 159). A hidden person's posts and comments leave
   History, but their own profile card stays (History.md) — so History is
   where the reader meets a hidden person's card most. Its ⋮ raises the profile
   card's menu, `FeedProfileMenu`'s rows — Save, Mention in a new post, the
   hide row, Report at the tail — with the hide row reading `Unhide @mira`,
   Settings · hidden accounts' word in the row's own form
   (`UNHIDE_ACTOR_LABEL`). Unstacked, over History's top viewport, as
   `HistoryPostMenu`; nothing on the card marks that the person is hidden.

   REGISTERED under the `history` prefix, `history.menuSheet`, each row named
   as `ProfileMenu` names it, the hide row keeping `hide` whatever it reads
   (round 36's paths). */
export const NODE = "history";
const HIDDEN_PROFILE_MENU = FEED_PROFILE_MENU("mira").map((row) => (row.node === "hide" ? { ...row, label: UNHIDE_ACTOR_LABEL("@mira") } : row));
export function Screen() {
  return (
    <>
      <HistoryTop>
        <ProfileFeedCard person={MIRA} src="inviter.jpg" bio="Runs the stand by the sea wall — honey from the headland hives." score="11.70" node="profileCard" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={HIDDEN_PROFILE_MENU} ariaLabel="Profile actions" />
    </>
  );
}
