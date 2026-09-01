Use `ProfileHeader` at the top of any profile — your own or someone else's. It is the only surface whose subject is a person.

```jsx
<ProfileHeader
  handle="ada" displayName="Ada Okonkwo" avatarSrc={ada.photo}
  bio="Coast roads, long exposures, and the occasional argument about routing."
  posts="12" stancesOn="128" stancesTaken="341" onCounts={openStances}
  bundle={bundles["u:ada"]} signedIn={!guest} taught={taught}
  onCommit={(pick, bundle) => keep("u:ada", bundle)}
/>

<ProfileHeader handle="you" displayName="Juno Baptiste" own
              posts="5" stancesOn="12" stancesTaken="96" onCounts={openStances}
              onEdit={openEditor} onInvites={openInvites} onAvatarChange={openAvatarFlow} />
```

- **The compact shape** (jakob 2026-09-01): avatar left; name, handle, and the figures in the column beside it; bio below; then the one actions row. The header is a summary, not a hero.
- **The stance on the person IS the actions row** — the wide anchor, stretched to the row. Everything rarer (mention, share) lives in the screen's top-bar overflow, never down here.
- **The figures, each labelled, never merged.** Posts leads; then "Stances on them" and "Stances they've taken". Do not write "followers", "connections", or "network" — the first describes a different product and the other two are banned vocabulary. The figures are one tap target (`onCounts`) toward the stances page, both directions separated there too.
- **`own` changes the row, not the layout.** Your own profile has no stance to take, so the row is `Edit profile` and `Invites` sharing the width; settings stays the screen's top-bar gear; applicant versus member is expressed in cards below, never as a different header.
- **The avatar changes without the edit screen.** One's own avatar wears the change badge (`onAvatarChange`) — the same signed crop-and-seal flow the edit screen also reaches.
- **No cover image or banner.** The largest thing on a person's screen should not be decoration.
- A photo is optional at every size; the monogram is the designed fallback, not a placeholder to be filled.
