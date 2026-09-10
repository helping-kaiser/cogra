Use `BottomNav` on every **read** surface — the tab roots and the read drill-ins (post detail, any actor's profile). Task flows (compose, profile edit, settings, invites, key and auth surfaces) carry a `PageHeader` back arrow instead and no bar.

```jsx
<BottomNav active="feed" onSelect={go} />                {/* what ships today */}
<BottomNav active="feed" slots={ALL_SLOTS} onSelect={go} /> {/* where it's going */}
```

Check any new layout against `ALL_SLOTS`: the bar grows to five as search and wallet get surfaces, and a design that only ever saw three slots is a design that breaks then. Don't ship a slot whose surface does not exist yet.

`onSelect` is a **re-entry, not a link**. Another tab comes back in the state it was left — its whole stack and scroll — or at its root, fresh, if it was never opened. The active tab pops to that tab's root when the reader is deep in it, scrolls to the top when they are already at the root, and at the top of the **feed** refreshes; Explore, Wallet and Profile do nothing there. A screen belongs to the stack it was opened from whatever its subject, so the same screen may sit in two tabs at two positions. State is session-only, and a sheet or dialog that was up is never restored. Full ladder: readme §13.

The centre slot is the compose action wearing `primaryContainer` — the one loud surface on the screen, so nothing else on that screen may take it. Show the same bar to signed-out readers: an account-needing slot opens `JoinPrompt` on tap, never a redirect. Selection is colour plus the filled icon cut; there is no indicator pill.

The discovery slot is keyed `search` — its route and its Material glyph — but its label reads **Explore**. "Graph" is on §7's banned list (implementation vocabulary), and "Explore" says what the reader is doing: discovery through the people they're connected to, not a global index. The graph meaning belongs in a sentence on that surface, not in a one-word label.
