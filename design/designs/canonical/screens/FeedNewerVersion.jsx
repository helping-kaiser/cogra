/* A NEWER VERSION, SAID ONCE (jakob 2026-10-01, backlog item 118: "users
   should also learn that there is a new version at least once when they open
   the app ... we dont force updates tho and dont annoy them"). A reference
   plate: the everyday feed a cold app open lands on, with one snackbar —
   drawn and wired nowhere; the shell's controls are `Feed`'s.

   ONCE PER RELEASE, ON A COLD OPEN. A fresh process, never a return to the
   foreground, finds a release newer than the one running here and a
   device-local seen flag that release has not set. The snackbar rises as the
   feed arrives — `A newer version of CoGra is out.` — and the flag is set,
   so each release says it exactly once on this device. Letting it time out,
   or dismissing it, costs nothing, and it never comes back.

   ITS ACTION OPENS WHAT'S NEW (`WhatsNewBehind`), named `What's new`, the
   settings row's own word: the Snackbar master takes one action word, and
   the destination's name is the shortest true one. The lane's call, flagged
   with the message for blessing (copy-voice, *The settings page*, About).

   THE SNACKBAR CHARTER'S STATED EXCEPTION. A snackbar is otherwise only a
   confirmation of a completed act; this one is jakob's deliberate second use,
   one quiet message per release. He flags that a snackbar is easy to miss
   ("it just takes a couple of seconds looking away") and may want something
   more obvious later — backlog item 121. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} />
      </FeedList>
      <Snackbar message={NEWER_VERSION_SNACKBAR} action="What's new" offset={80} />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
