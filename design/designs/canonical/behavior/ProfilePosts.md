# ProfilePosts · `spec:design:behavior-profile-posts`

ALWAYS the posts view lists the person's posts as post cards, never as chronicle entries

ALWAYS at most one clip plays in the posts view, by the feed's stage law

WHEN scroll settles at the posts view's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in the posts view's order

WHEN an overscroll bounce settles back at the posts view's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in the posts view's order

ALWAYS the header block above the tab row stands unchanged in every tab view, and only the list below the tab row changes

ALWAYS the ⋮ closes the actions row and holds the whole profile menu, as the profile's own page does

ALWAYS the header bar carries the way back alone, titled with the person's handle

WHEN tap the Comments tab -> the person's comments stand below the tab row AND the header above stays as it was

WHEN tap the Everything tab -> the person's chronicle stands below the tab row AND the header above stays as it was

WHEN tap the Posts tab -> NEVER anything changes

WHEN tap the author chip on one of the person's own cards -> NEVER anything changes

WHEN tap the ⋮ in the actions row -> the profile's menu opens over the page

WHEN tap the figures -> the opinions page opens on this profile

WHEN tap Message -> the chats coming-soon screen opens

WHEN a guest taps Message -> the guest gate opens

WHEN a guest taps the profile's stance anchor -> the guest gate opens

WHEN tap a card's Feed score GIVEN the profile is another's -> the score's trace opens AND its back arrow reads Back to the profile

WHEN tap a card's Feed score GIVEN the profile is the reader's own -> the score's trace opens AND its back arrow reads Back to your profile

WHEN tap a portrait clip on a card GIVEN the profile is another's -> the stream opens AND its back arrow reads Back to the profile

WHEN tap a portrait clip on a card GIVEN the profile is the reader's own -> the stream opens AND its back arrow reads Back to your profile

WHEN tap a card's media GIVEN it is not a portrait clip and the profile is another's -> the post's detail opens AND its back arrow reads Back to the profile

WHEN tap a card's media GIVEN it is not a portrait clip and the profile is the reader's own -> the post's detail opens AND its back arrow reads Back to your profile

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed from the feed in any of its states, Back to the post from a post's author chip, opinions or references, Back to the comments from the comments sheet, Back to the stream from the stream, Back to Notifications from Notifications, Back to Saved from Saved, Back to History from History, Back to the opinions from a profile's opinions list and Back to with the tag's name from a tag's page

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the profile was entered with no history behind it

WHEN pull down GIVEN the posts view stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

ALWAYS the bottom bar rides with no slot lit
