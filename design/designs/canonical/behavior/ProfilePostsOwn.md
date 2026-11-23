# ProfilePostsOwn · `spec:design:behavior-profile-posts-own`

ALWAYS the reader's own profile's Posts view is where the own profile lands, from any door, its states — empty, settling, loading, failed — the landing's own

ALWAYS the reader's own profile's Posts view keeps the own profile's head as the profile's own page draws it, the band, the header with Edit profile and Invites, and profile.tabRow.postsTab lit

ALWAYS profile.posts lists the reader's own posts, each card the feed's own, fully live

ALWAYS profile.posts lists a post the reader signed that is still settling at the head of the list, above every landed one, the settling posts newest signed first among themselves, its card wearing Still settling and carrying no score, its score slot bare, as the feed's card does, and it takes its place in the list's order when it lands

ALWAYS profile.identity.figures.posts counts every post the reader published, a removed one and a still-settling one included, and never an edit, so the figure and the list agree

ALWAYS the ⋮ on a card holds the own post menu, Edit among its rows, and carries no Hide and no Report row

WHEN tap the ⋮ on profile.posts.card -> profile.menuSheet rises over the reader's own profile with the own post menu's rows

ALWAYS a removed post of the reader's own keeps its place in the list as the feed's removed card, profile.posts.card.removalMark reading Removed by its author with the removal's date, whatever the feed's filter holds, its ⋮ your own post's menu less Edit, Mark as sensitive and Remove

ALWAYS a post of the reader's own removed before it lands wears both marks, profile.posts.card.removalMark in the content's place and Still settling over its action row, its score slot bare, at the head of the list among the settling posts, its ⋮ your own removed post's menu, GIVEN the post is still settling

WHEN tap profile.tabRow.commentsTab -> the reader's own comments stand below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.everythingTab -> the reader's own chronicle stands below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.postsTab -> NEVER anything changes

WHEN tap Edit profile -> the profile edit opens

ALWAYS profile.posts.empty below profile.tabRow reads Nothing here yet., the line alone, GIVEN the reader has published no post, an applicant's own tab as a member's, only Everything carrying the applicant's own line

WHEN the tab's first page has not arrived 200ms after it was asked for -> profile.posts.loading stands in the list's place, reading Loading… AND NEVER profile.posts.empty stands meanwhile AND NEVER a skeleton card or a spinner appears

WHEN the tab's first page does not arrive -> profile.posts.moreFault stands where the list would stand, reading Can't reach the server — posts can't load right now., then profile.posts.moreFault.retry as an inline action, Couldn't load more being a failed next page's line alone AND NEVER the line takes the error colour AND NEVER a full-tab fault stands

WHEN the first page has not arrived 200ms after profile.posts.moreFault.retry is tapped -> Loading… stands in the row's place AND NEVER a spinner appears

WHEN the retried first page arrives -> its cards stand below profile.tabRow AND profile.posts.moreFault goes
