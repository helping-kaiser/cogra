# ProfileStances · `spec:design:behavior-profile-stances`

ALWAYS profileStances.header.title reads the person's handle and Opinions, @ada · Opinions

ALWAYS profileStances.header.title reads Opinions alone GIVEN the account was deleted, the handle dropped and never replaced

ALWAYS the two directions stand on profileStances.tabRow, two tabs named in words, and never in one merged list

ALWAYS profileStances.tabRow.onTab and profileStances.tabRow.byTab read On them and By them GIVEN the page is another person's or a deleted account's

ALWAYS profileStances.tabRow.onTab and profileStances.tabRow.byTab read On you and By you GIVEN the page is the reader's own

ALWAYS each profileStances.list.row is a person with the public opinion the row is about, its face leading and its pair in the reader's reading mode

ALWAYS a row's face is 🤔, spoken as the state, as Interested, no side taken on +0.00 / +0.35, never a table face, GIVEN the row's opinion has exactly one number at zero

ALWAYS a row's opinion is read-only, and no row carries a control that changes it

ALWAYS the rows of profileStances.list stand strongest first, by the for-or-against value, down past nothing into the ones held against

ALWAYS the reader is never a row on their own page

ALWAYS profileStances.list.redactedRow stands for a person whose account was deleted, where its value puts it, profileStances.list.redactedRow.name reading Deleted account in the system's voice, with the reserved disc and no handle line

ALWAYS profileStances.list.redactedRow keeps the opinion it holds or is held by, read as any row's

WHEN tap profileStances.list.redactedRow -> the deleted account's page opens

WHEN tap profileStances.tabRow.onTab -> the people holding an opinion on this person stand in profileStances.list

WHEN tap profileStances.tabRow.byTab -> the people this person holds an opinion on stand in profileStances.list

ALWAYS profileStances.empty stands in profileStances.list's place, calm and in no error colour, GIVEN the tab holds no one

ALWAYS profileStances.empty.title reads No opinions yet — yours would be the first. GIVEN another person's On them holds no one

ALWAYS profileStances.empty.title reads No opinions by @ada yet. GIVEN another person's By them holds no one

ALWAYS profileStances.empty.title reads No opinions on you yet. GIVEN the reader's own On you holds no one

ALWAYS profileStances.empty.title reads No opinions by you yet. GIVEN the reader's own By you holds no one

ALWAYS profileStances.empty.title reads No opinions on this account yet. GIVEN a deleted account's On them holds no one

ALWAYS profileStances.empty.title reads This account gave no opinions. GIVEN a deleted account's By them holds no one

WHEN tap profileStances.list.row -> that person's profile opens AND its back arrow reads Back to the opinions

WHEN tap profileStances.header.back -> the profile whose figures were tapped comes back, in the state it was left

ALWAYS profileStances.header.back reads Back to the profile GIVEN the page was opened from another's profile or a deleted account's

ALWAYS profileStances.header.back reads Back to your profile GIVEN the page was opened from the reader's own profile

ALWAYS profileStances.bottomBar keeps lit the slot of the root the profile was opened from, profileStances.bottomBar.feedSlot from the feed

ALWAYS a profile opened from profileStances.list.row keeps lit the slot the opinions page keeps, the root its stack began in, and never Feed by default

WHEN scroll down -> profileStances.header and profileStances.tabRow collapse with the page AND they return on the way up

WHEN pull down GIVEN the page stands all the way at its top -> the page refreshes AND the platform's own refresh indicator shows
