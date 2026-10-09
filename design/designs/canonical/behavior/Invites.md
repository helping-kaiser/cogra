# Invites · `spec:design:behavior-invites`

ALWAYS Invites carries no bottom bar

ALWAYS New invite heads the column, a filled button at the column's full width

ALWAYS the page reads Applications, then Live links, in that order

ALWAYS applications stand grouped by the link they came through, each group labelled with its link and its waiting count, as Many uses · 4 waiting

ALWAYS the groups stand by their oldest waiting application and the rows by age inside them, so the oldest application in the queue is the first row under any kept approval

ALWAYS the queue is never ordered by whether the reader can act on a row

ALWAYS a group carries Close all GIVEN more than one application in it waits

ALWAYS a group carries no batch control GIVEN one application in it waits

ALWAYS an application's row wears the monogram from the handle and the handle alone, never a picture and never a display name

ALWAYS an application's second line reads Ready for your approval GIVEN the reader can approve it, and Not fully registered yet otherwise, never naming the proof still missing

ALWAYS every application's row carries its own close, the close glyph alone, spoken with the handle it closes, as Close @imke's application

ALWAYS an application's row names the asker Deleted account, and its close's spoken name and every snackbar naming the asker say a deleted account in the handle's place, as Close a deleted account's application GIVEN the asker's account was deleted

ALWAYS a live link's card holds the link whole, never truncated, labelled Single use · not used yet or Many uses, captioned with when it expires, with its copy control and Revoke

ALWAYS a link that no longer works never stands under Live links

ALWAYS the inviter reward appears nowhere on the page

ALWAYS the word token appears nowhere on the page

ALWAYS the header collapses on the way down and returns on the way up

WHEN tap New invite -> the create sheet opens over the page

WHEN tap an application's row GIVEN it reads Not fully registered yet -> the snackbar reads @imke has to finish registering before you can approve AND NEVER the pad opens

WHEN tap an application's row GIVEN it reads Ready for your approval -> the approval pad opens on that application

WHEN tap an application's close -> the dialog asking to close that application opens

WHEN tap a group's Close all -> the dialog asking to close all of that group's waiting applications opens

WHEN tap a link's copy control -> the link lands on the clipboard AND the snackbar reads Link copied

WHEN tap a link's Revoke -> the card holds until the revoke answers AND Revoke refuses a second press until the revoke answers AND NEVER a dialog asks AND NEVER Undo is offered

WHEN the revoke has not answered 200ms after the press -> Revoke reads Revoking… in its own place AND NEVER a spinner appears

WHEN a link's Revoke lands -> the card leaves the page AND the snackbar reads Invite revoked AND NEVER Undo is offered

WHEN a link's Revoke lands -> every application already staged through the link stays in the queue, approvable

WHEN a link's Revoke lands GIVEN nothing else stands on the page -> the empty Invites stands

WHEN a link's Revoke does not go through -> the card stays AND the fault answers in the network fault's grammar

WHEN a row or a card removes itself -> focus moves to the next row, else the previous, else the empty state

WHEN the key comes back GIVEN an approval was set while the key was elsewhere -> it surfaces on Invites as that application's ready row AND it signs through the approval pad AND NEVER it joins the kept picks' review

WHEN a vouch on an ask link is kept for the key -> it stands on Invites as a kept approval of its own AND NEVER it joins the kept picks

WHEN the key comes back GIVEN a vouch on an ask link was kept for the key -> the kept approval waits on Invites AND it signs through the approval pad AND NEVER it joins the kept picks' review

WHEN a vouch on an ask link is kept because the asker is not fully registered yet -> it stands on Invites as a kept approval of its own AND NEVER anything is signed or spent AND NEVER it joins the kept picks

ALWAYS a kept approval stands as one row at the head of Applications, before every group, in the application row's anatomy GIVEN a vouch on an ask link was kept for the key or for the asker's registration

ALWAYS the kept approval's second line reads Waiting for your key GIVEN the key is elsewhere

ALWAYS the kept approval's second line reads Ready for your approval GIVEN the key is back

ALWAYS the kept approval's second line reads Not fully registered yet GIVEN the asker is not fully registered yet, and Ready for your approval once they are

WHEN tap the kept approval's row GIVEN the key is elsewhere -> the key notice opens, as a kept pick's face does AND NEVER the approval pad opens

WHEN tap the kept approval's row GIVEN the key is back -> the approval pad opens on that applicant

WHEN tap the kept approval's row GIVEN it reads Not fully registered yet -> the snackbar reads @noor has to finish registering before you can approve AND NEVER the approval pad opens

WHEN tap the kept approval's row GIVEN it reads Ready for your approval -> the approval pad opens on that applicant AND it signs only there

WHEN tap the kept approval's close -> the dialog asking to close that application opens, the one every row's close raises

WHEN the close of a kept approval is taken -> the row leaves AND the kept vouch is dropped AND nothing is signed

WHEN pull down GIVEN the page stands all the way at its top -> the page refreshes AND the platform's own refresh indicator shows

WHEN a member opens an ask link GIVEN the asker already waits in their invites -> Invites opens AND the snackbar reads @noor is already waiting in your invites.

WHEN tap the back arrow -> the screen Invites was opened from comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile from the reader's own profile, Back to Notifications from Notifications, and Back to Kept picks from the kept picks' review or their seal
