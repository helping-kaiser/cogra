Use `ProfileHeader` at the top of any profile — your own or someone else's. It is the only surface whose subject is a person.

```jsx
<ProfileHeader
  handle="ada" displayName="Ada Okonkwo" avatarSrc={ada.photo}
  bio="Coast roads, long exposures, and the occasional argument about routing."
  posts="12" stancesOn="128" stancesTaken="341" onCounts={openStances}
  bundle={bundles["u:ada"]} signedIn={!guest} taught={taught}
  onCommit={(pick, bundle) => keep("u:ada", bundle)}
  menu={<OverflowMenu placement="row" ariaLabel="More about @ada" items={profileMenu} />}
/>

<ProfileHeader handle="you" displayName="Juno Baptiste" own
              posts="5" stancesOn="12" stancesTaken="96" onCounts={openStances}
              onEdit={openEditor} onInvites={openInvites} onAvatarChange={openAvatarFlow}
              menu={<OverflowMenu placement="row" ariaLabel="More on your profile" items={ownMenu} />} />
```

- **The compact shape** (jakob 2026-09-01): avatar left; name, handle, and the figures in the column beside it; bio below; then the one actions row. The header is a summary, not a hero.
- **The stance on the person leads the actions row** — the wide anchor, taking whatever the row has left. `Message` stands beside it at the width of its own word, and the page's `menu` closes the row: since the band law no band carries a ⋮, so a profile's rarer acts (mention, share, save, hide) hang off the row that holds its other acts.
- **The row is mode-invariant.** Message is sized by content and the anchor takes the remainder, so the exact pair a geek reader turns on paints inside the anchor's own space and nothing in the row moves (`ProfileOtherHeld` is the board that records it).
- **The figures, each labelled, never merged.** Posts leads; then "Opinions on them" and "Opinions by them". Do not write "followers", "connections", or "network" — the first describes a different product and the other two are banned vocabulary. The figures are one tap target (`onCounts`) toward the opinions page, both directions separated there too.
- **`own` changes the row, not the layout.** Your own profile has no opinion to give, so the row is `Edit profile` and `Invites` sharing what the ⋮ leaves; settings stays the band's gear; applicant versus member is expressed in cards below, never as a different header.
- **The avatar changes without the edit screen.** One's own avatar wears the change badge (`onAvatarChange`) — the same signed crop-and-seal flow the edit screen also reaches.
- **`redacted` is a deleted account, and it changes nothing structural.** The counts, the tabs, the chronicle and the actions row are all still there and still true — only the identity is placeholdered: the reserved disc, `Deleted account` in `text-secondary`, no handle, and the redaction mark in the bio's place. Give the actions row its opinion control and nothing else: an opinion targets the actor, which is still there, and a message targets a person, who is not.
- **No cover image or banner.** The largest thing on a person's screen should not be decoration.
- A photo is optional at every size; the monogram is the designed fallback, not a placeholder to be filled.
