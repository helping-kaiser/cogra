Use `ProfileHeader` at the top of any profile — your own or someone else's. It is the only surface whose subject is a person.

```jsx
<ProfileHeader
  handle="ada" displayName="Ada Okonkwo" avatarSrc={ada.photo}
  bio="Coast roads, long exposures, and the occasional argument about routing."
  stancesOn="128" stancesTaken="341"
  bundle={bundles["u:ada"]} signedIn={!guest} taught={taught}
  onCommit={(pick, bundle) => keep("u:ada", bundle)}
  menuItems={[{ label: "Copy link", onSelect: copyLink }, { label: "Report", onSelect: report }]}
/>

<ProfileHeader handle="you" displayName="Juno Baptiste" own
              stancesOn="12" stancesTaken="96"
              onEdit={openEditor} onSettings={openSettings} />
```

- **The stance on the person leads the actions row.** A person is the most consequential thing to have a stance on; everything rarer goes in the overflow menu.
- **Two counts, each labelled, never merged.** "Stances on them" and "Stances they've taken". Do not write "followers", "connections", or "network" — the first describes a different product and the other two are banned vocabulary.
- **`own` changes the row, not the layout.** Your own profile has no stance to take, so it carries `Edit profile` and settings; applicant versus member is expressed in cards below, never as a different header.
- **No cover image or banner.** The largest thing on a person's screen should not be decoration.
- A photo is optional at every size; the monogram is the designed fallback, not a placeholder to be filled.
