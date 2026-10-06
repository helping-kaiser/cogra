# Main · `spec:design:behavior-main`

WHEN an invite link is opened GIVEN the reader is signed out -> the landing opens on the live public feed from the link's issuer's view AND NEVER the join form opens first

ALWAYS the landing borrows the view of the invite link's issuer, whether the link is live or no longer usable

ALWAYS the band names the borrowed view, Browsing from @mira's view — join to build your own., beside the issuer's face, with Sign in or join

ALWAYS the band carries no bell GIVEN the reader is a guest

ALWAYS every stance face wears the issuer's own stance, read-only, at the member's anchor geometry, and the hollow face wherever the issuer holds none GIVEN the reader is a guest

ALWAYS the landing carries On Android? Download the app (APK) under the band on the web, and never in the app

WHEN tap Sign in or join GIVEN the invite link held is live -> the join form opens with the link in hand AND NEVER the invite-link door opens AND NEVER the reader pastes the link again

WHEN tap Sign in or join GIVEN the invite link held no longer works -> the page This invite can't be used anymore opens and takes another link

WHEN a dead invite link arrives GIVEN the reader is signed out -> the landing opens unchanged AND the snackbar reads This invite link has expired. once

ALWAYS a dead link's arrival reads This invite link has expired. whether the link expired, was used up, was revoked or resolves to nothing

WHEN a dead invite link is opened GIVEN the reader is signed in -> the reader stays exactly where they were, or on their own landing when the app opened cold AND the snackbar reads This invite link has expired. AND NEVER the guest landing opens

WHEN tap On Android? Download the app (APK) -> the browser downloads the APK

WHEN tap a stance face -> the join prompt opens over the landing AND NEVER anything is staged

WHEN tap the bottom bar's New post -> the join prompt opens over the landing

WHEN tap the bottom bar's Profile -> the join prompt opens over the landing

WHEN tap the band's chats -> the join prompt opens over the landing

WHEN tap the bottom bar's Wallet -> the wallet's coming-soon door opens, the same door members meet

WHEN tap the bottom bar's Explore -> Explore opens

ALWAYS the bottom bar carries all five slots for a guest, the same bar members see

ALWAYS a guest climbs the same re-tap ladder a member climbs, and the gates in front of the slots stay as they are

WHEN tap the bottom bar's Feed GIVEN the landing is scrolled -> the landing travels back to its top, animated AND NEVER the feed reloads

WHEN tap the bottom bar's Feed GIVEN the landing stands at its top -> the feed refreshes and loads what is new AND the platform's own refresh indicator shows

WHEN pull down GIVEN the landing stands all the way at its top -> the feed refreshes and loads what is new AND the platform's own refresh indicator shows

WHEN tap the filter chip -> the feed's filter sheet opens

WHEN tap a post's pictures -> the post opens

WHEN tap a post's clip GIVEN the clip is wider than tall -> the post opens on its clip

WHEN tap a post's clip GIVEN the clip is portrait -> the stream opens

WHEN tap a post's author chip -> that author's profile opens

WHEN tap a post's ⋮ -> the reader's menu opens

WHEN tap More on a caption -> the caption unfolds in place

WHEN tap a tag chip -> the tag's page opens

WHEN tap a post's reference count -> the references sheet opens

WHEN tap a post's Feed score -> the score's drill-down opens

WHEN tap a post's comment count -> the comments thread opens

WHEN tap a post's share -> the platform's own share sheet opens
