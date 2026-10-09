# ApplicantFeed · `spec:design:behavior-applicant-feed`

ALWAYS the feed reads from the view of the issuer of the invite link the applicant registered through

ALWAYS the band reads Browsing from @mira's view while your application lands. naming that issuer

ALWAYS the band reads Browsing from a deleted account's view while your application lands. GIVEN the issuer's account was deleted

ALWAYS the application rides the feed as task cards above the posts

ALWAYS the verify card stands GIVEN the email is not verified yet

ALWAYS the key card stands GIVEN no key is attached to the application yet

ALWAYS the key card's body reads Your application needs a key on this browser before @mira can approve it. on the web and Your application needs a key in this app before @mira can approve it. in the app

ALWAYS either owed step can be done first, and the other's card stands until it is

ALWAYS the verify card and the key card carry no way to put them away

ALWAYS the verify card prints the address the link was sent to, beside Wrong address?

ALWAYS the line An account left unverified for seven days is removed — joining again then starts over. stands on the verify card and on no other surface

ALWAYS no figure counts down the seven days on any surface

WHEN the email is verified -> the verify card leaves AND the cards still owed stay

WHEN the key is attached -> the key card leaves AND the cards still owed stay

WHEN the last owed step is done -> the waiting card takes the task cards' place

WHEN tap Resend the link -> the verification mail goes out again AND the verify card stays AND the snackbar reads Sent — the link is on its way to noor@fieldmail.org. with the address the card prints

WHEN tap Resend the link GIVEN the reader is offline -> the network error answers

WHEN tap Wrong address? -> the applicant's email change opens

WHEN tap Create my key -> the key ceremony opens

WHEN tap Create my key GIVEN a browser that cannot hold a key -> the ceremony says so before anything is minted

ALWAYS every stance face wears the applicant's own stance — staged or held, never the inviter's — and the hollow face wherever they hold none, the feed's walk alone borrowing the inviter's vantage (stance-control, *Only a nobody borrows stances*)

WHEN tap a stance face for the first time as an applicant -> the pad blooms AND the opinion stages with the application once Set

WHEN the first opinion stages, by Set or by a press-and-hold -> the face takes the staged pick AND the snackbar reads Your opinion waits with your application — it arrives with you.

WHEN press-and-hold a stance face GIVEN no opinion is staged yet -> a positive opinion stages with the application

WHEN tap a stance face GIVEN an opinion is already staged -> the snackbar reads Your opinion waits with your application — it arrives with you. AND NEVER the pad opens

WHEN tap New post on the bar GIVEN no post is staged yet -> the wizard opens AND the post stages with the application

WHEN tap New post on the bar GIVEN a post is already staged -> the snackbar reads Your post waits with your application — it arrives with you. AND NEVER the wizard opens

ALWAYS a staged act is seen by the applicant alone, in their own chronicle

WHEN tap Profile on the bar -> the applicant's own profile opens

WHEN the reader first enters this feed GIVEN the intro's seen flag is unset -> the intro opens over the feed at its first card
