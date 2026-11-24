# ApplicantFeed · `spec:design:behavior-applicant-feed`

ALWAYS the feed reads from the view of the issuer of the invite link the applicant registered through

ALWAYS the band reads Browsing from @mira's view. naming that issuer

ALWAYS the band reads Browsing from a deleted account's view. GIVEN the issuer's account was deleted

ALWAYS the application rides the feed as task cards above the posts

ALWAYS feed.verifyCard stands GIVEN the email is not verified yet

ALWAYS feed.keyCard stands GIVEN no key is attached to the application yet

ALWAYS feed.keyCard.title reads Create your key GIVEN the applicant has no key yet

ALWAYS feed.keyCard.body reads Your application needs a key on this browser before @mira can approve it. on the web and Your application needs a key in this app before @mira can approve it. in the app GIVEN the applicant has no key yet

ALWAYS feed.keyCard.title reads Attach your key GIVEN the applicant's own key is on this device and not attached

ALWAYS feed.keyCard.body reads Your key is on this browser. It hasn't reached your application yet. on the web and Your key is in this app. It hasn't reached your application yet. in the app GIVEN the applicant's own key is on this device and not attached

ALWAYS either owed step can be done first, and the other's card stands until it is

ALWAYS feed.verifyCard and feed.keyCard carry no way to put them away

ALWAYS feed.verifyCard prints the address the link was sent to, beside feed.verifyCard.wrongAddress

ALWAYS the line An account left unverified for seven days is removed — joining again then starts over. stands on feed.verifyCard and on no other surface

ALWAYS no figure counts down the seven days on any surface

WHEN the email is verified -> feed.verifyCard leaves AND the cards still owed stay

WHEN the key is attached -> feed.keyCard leaves AND the cards still owed stay

WHEN the applicant's own key, on this device and not yet attached, fails to attach -> feed.keyCard reads Attach your key AND feed.keyCard.attachFault reads That didn't go through. with Retry at its end in the place of Create my key AND NEVER a fresh key is offered in its place AND NEVER the key is said to belong to another account

WHEN tap the Retry of feed.keyCard.attachFault -> the same key is attached again AND feed.keyCard leaves once it is attached

WHEN the last owed step is done -> the waiting card takes the task cards' place

WHEN tap Resend the link -> the verification mail goes out again AND feed.verifyCard stays AND the snackbar reads Sent — the link is on its way to noor@fieldmail.org. with the address the card prints

WHEN tap Resend the link GIVEN the reader is offline -> the network error answers

WHEN tap feed.verifyCard.wrongAddress -> the applicant's email change opens

WHEN tap Create my key -> the key ceremony opens

WHEN tap Create my key GIVEN a browser that cannot hold a key -> the ceremony says so before anything is minted

ALWAYS every stance face wears the hollow face, never the inviter's stance, the feed's walk alone borrowing the inviter's vantage (stance-control, *Only a nobody borrows stances*)

WHEN tap a stance face -> the snackbar reads You can give your opinion once you're in. AND NEVER the pad blooms

WHEN press-and-hold a stance face -> the snackbar reads You can give your opinion once you're in. AND NEVER anything is signed or staged

WHEN tap New post on the bar -> the snackbar reads You can post once you're in. AND NEVER the wizard opens

ALWAYS feed.bottomBar.composeSlot wears the locked look, visibly inactive at the disabled opacity and still tappable

ALWAYS every feed.card.actionRow.stance.anchor wears the locked look, visibly inactive at the disabled opacity and still tappable

WHEN tap Profile on the bar -> the applicant's own profile opens

WHEN the reader first enters this feed GIVEN the intro's seen flag is unset -> the intro opens over the feed at its first card

ALWAYS the newer-version snackbar announces on this feed as on the member's, once per release on a cold open
