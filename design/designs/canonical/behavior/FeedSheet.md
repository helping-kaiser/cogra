# FeedSheet · `spec:design:behavior-feed-sheet`

WHEN feed.filterSheet opens -> it stands at 88% of the screen's height

ALWAYS the filter's kinds are the kinds V1.0 serves: Posts, Comments, Profiles and Tags

ALWAYS the kind chips combine

ALWAYS the form chips combine

ALWAYS the order is Ranked or Newest, never both

ALWAYS feed.filterSheet.people holds the rows feed.filterSheet.people.everyone and feed.filterSheet.people.yourPeople, one on and never both

ALWAYS feed.filterSheet.people.yourPeople narrows the feed to the people the reader holds an opinion of, whichever way it points, over the same rank

WHEN tap feed.filterSheet.people.everyone or feed.filterSheet.people.yourPeople -> the choice is staged AND NEVER the feed behind the sheet moves before Done

ALWAYS feed.filterSheet.people.sign stands under feed.filterSheet.people.yourPeople as one line of three words, For · Against · Either, the chosen word in primary ink and never a pill GIVEN feed.filterSheet.people.yourPeople is on

ALWAYS no feed.filterSheet.people.sign stands GIVEN feed.filterSheet.people.everyone is on

ALWAYS feed.filterSheet.people.sign.for narrows feed.filterSheet.people.yourPeople to the people the reader is for, feed.filterSheet.people.sign.against to the people the reader is against, and feed.filterSheet.people.sign.either to both

WHEN tap feed.filterSheet.people.sign.for, feed.filterSheet.people.sign.against or feed.filterSheet.people.sign.either -> that word is chosen, staged AND NEVER the feed behind the sheet moves before Done

WHEN tap feed.filterSheet.people.everyone GIVEN feed.filterSheet.people.yourPeople is on -> feed.filterSheet.people.sign goes AND its chosen word is kept for feed.filterSheet.people.yourPeople's return

ALWAYS the filter's topic chips are the topics the reader holds an opinion for

ALWAYS at most one topic chip is on

WHEN tap a topic chip GIVEN it is off -> it turns on AND every other topic chip turns off

WHEN tap a topic chip GIVEN it is on -> it turns off AND NEVER another topic chip turns on

WHEN tap a kind, form, topic or also-show chip -> the chip's change is staged AND NEVER the feed behind the sheet moves before Done

WHEN tap Ranked or Newest -> that order is staged AND NEVER the feed behind the sheet moves before Done

WHEN tap Show what you've already seen -> the toggle flips, staged AND NEVER the feed behind the sheet moves before Done

ALWAYS Posts is the one kind on, Ranked is the order, Everyone is the people row on, Either is the sign row's chosen word, Show what you've already seen is off, Still settling is on and Sensitive and Removed are off GIVEN the filter is at its default and the reader has set no default of their own in Settings

ALWAYS the feed admits content not yet landed, wearing Still settling GIVEN the feed's filter has Still settling on

ALWAYS content not yet landed is woven in among the landed rows, ranked by the reader's reach to its author through the one edge it was born with GIVEN the feed's filter has Still settling on and the order is Ranked

ALWAYS a row not yet landed wears Still settling and carries no score, its score slot bare

ALWAYS the feed admits only what has landed GIVEN the feed's filter has Still settling off

ALWAYS the topic section is the last section of the sheet's body

ALWAYS the sheet's foot holds Reset in its corner and Done at its end, and no section holds Reset

ALWAYS the sheet's foot carries no reading of the staged filter

ALWAYS the reader's default is the app's default GIVEN the reader has set no default of their own in Settings

ALWAYS the reader's default is the one they set GIVEN the reader has set a default of their own in Settings

WHEN tap Reset -> the sheet stages the reader's default AND NEVER the feed re-queries

ALWAYS a filter committed with Done lasts on this device until the reader changes it, through a reload, a restart and a cold launch alike, and the feed opens with it

ALWAYS a filter committed with Done never travels to another device and never changes the reader's saved default in Settings

ALWAYS the trigger speaks only the deviations from the reader's default

ALWAYS the trigger speaks a deviation back toward the app's default like any other GIVEN the reader's own default differs from the app's

ALWAYS the trigger speaks each departing axis's state, never the direction it departs in

ALWAYS feed.band.filterTrigger reads feed.filterSheet.people.yourPeople.label's words in lowercase among its deviations, then a comma and the chosen sign's word in lowercase, GIVEN feed.filterSheet.people.yourPeople is on and feed.filterSheet.people.sign.for or feed.filterSheet.people.sign.against is chosen

ALWAYS feed.band.filterTrigger reads everyone among its deviations GIVEN the reader's saved default narrows the feed to their own people and feed.filterSheet.people.everyone is on

ALWAYS the filter's "?" says Reset brings back your defaults, to change them go to settings.

ALWAYS the feed filter's "?" says What you've already seen waits below the Already seen line unless you ask for it back. and the search sheet's keeps its stays-out sentence

WHEN the last kind chip is switched off -> NEVER the chip refuses the tap

WHEN pull down inside feed.filterSheet -> NEVER the feed refreshes

ALWAYS the trigger's spoken name is its reading followed by what your feed shows

ALWAYS the People section's second row reads the borrowed view's account's name the band's way, as @mira's people, over Only the people @mira holds an opinion of — the same rank, narrowed to them. GIVEN the feed borrows a view

ALWAYS Everyone's line reads The whole feed, as far as @mira's eyes reach. GIVEN the feed borrows a view

ALWAYS @mira's people narrows the feed to the people the borrowed view's account holds an opinion of, by that account's marks and never the reader's, and For, Against and Either narrow it by that account's sign GIVEN the feed borrows a view

ALWAYS the sign row's spoken name is Which of @mira's people GIVEN the feed borrows a view

ALWAYS the trigger reads the people extra by the borrowed view's account's name, as @mira's people, @mira's people, for or @mira's people, against, and past the pill's budget collapses to the count like any extra GIVEN the feed borrows a view and @mira's people is on

ALWAYS Order's line reads Ranked puts what's closest to @mira first — the view you're browsing from. Newest ignores it and lists by time. GIVEN the feed borrows a view

ALWAYS the topic chips are the topics the borrowed view's account holds and is for, under Topics @mira holds and is for. A topic @mira holds against stays a record — it just never narrows a feed. GIVEN the feed borrows a view

ALWAYS Show what you've already seen, the kinds, the kinds of post, Also show, Reset and the "?" keep the reader's own first person GIVEN the feed borrows a view

ALWAYS All your topics keeps its words and opens the reader's own Your topics, never the borrowed view's account's list GIVEN the feed borrows a view

ALWAYS the topic section does not stand GIVEN the feed borrows a view and the borrowed view's account holds no topic it is for

WHEN tap Done GIVEN the staged filter changes Kinds or the topic -> the sheet closes AND the feed re-queries once AND one polite status message says the trigger's new name AND focus returns to the trigger AND NEVER the message draws anything

WHEN tap Done GIVEN every staged change is the device's own — the people row and its sign, the order, Show what you've already seen, the kinds of post, Sensitive, Removed or Still settling -> the sheet closes AND the feed re-derives on the device from what it already holds AND one polite status message says the trigger's new name AND focus returns to the trigger AND NEVER the feed re-queries AND NEVER the message draws anything

ALWAYS Done carries the Already seen separator and the seen rows under it to the new filter by the same rule as the rows above it, re-derived on the device where every staged change is the device's own and re-queried where Kinds or the topic changed

WHEN tap Done GIVEN the staged filter is the feed's own, nothing changed -> the sheet closes AND the feed is what it was AND focus returns to the trigger AND NEVER the feed re-queries

WHEN tap the scrim -> the sheet closes AND the staged filter is dropped AND the feed is what it was AND NEVER the feed re-queries

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the staged filter is dropped AND the feed is what it was AND NEVER the feed re-queries
