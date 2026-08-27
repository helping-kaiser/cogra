import React from "react";
import { MonogramAvatar } from "./ActorChip.jsx";
import { Button } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { OverflowMenu } from "../content/OverflowMenu.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";

/* The profile header (backlog item 5) — specified in design.md §6, never built.

   PEOPLE FIRST, AND A PERSON IS A TARGET. A profile is the one surface whose
   subject is a person, so the stance control on THEM leads the actions: the whole
   product is stances on things, and a person is the most consequential thing to
   have one on.

   THE COUNTS ARE THE HARD PART. The thing being counted is what the repo calls a
   connection, and that word is on the banned list (readme §3) along with the rest
   of the implementation vocabulary. So the header counts what a reader can
   actually place: how many people have taken a stance on this person, and how many
   this person has taken. Two figures, each labelled, each plain — never one merged
   "followers" number, because there is no following here and borrowing the word
   would describe a different product.

   No cover image, no banner: the system has no imagery slot that size, and a
   decorative band would be the largest thing on a screen whose subject is a
   person's record.

   It is not a card. It is the top of a screen, on the page ground — a card would
   imply a second card beside it. */

function Figure({ value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>{value}</span>
      <span style={{ fontSize: "var(--text-label-small)", fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

export function ProfileHeader({
  handle,
  displayName,
  avatarSrc,
  bio,
  stancesOn,
  stancesTaken,
  own = false,
  signedIn = true,
  taught = true,
  bundle,
  onCommit,
  onEdit,
  onSettings,
  menuItems = [],
}) {
  const name = displayName && displayName.trim() ? displayName : handle;
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4) 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <MonogramAvatar name={name} size="lg" src={avatarSrc} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)", overflowWrap: "anywhere" }}>{name}</h1>
          <span style={{ fontSize: "var(--text-body-medium)", color: "var(--text-secondary)" }}>@{handle}</span>
        </div>
      </div>
      {bio && <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{bio}</p>}
      {(stancesOn !== undefined || stancesTaken !== undefined) && (
        <div style={{ display: "flex", gap: "var(--space-6)" }}>
          {stancesOn !== undefined && <Figure value={stancesOn} label={own ? "Stances on you" : "Stances on them"} />}
          {stancesTaken !== undefined && <Figure value={stancesTaken} label={own ? "Stances you've taken" : "Stances they've taken"} />}
        </div>
      )}
      {/* The actions row. On someone else's profile the stance leads and everything
          rarer is in the menu. On your own there is no stance to take, so the row
          is the two things you do to your own record. */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {own ? (
          <>
            {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>Edit profile</Button>}
            {onSettings && (
              <button
                type="button"
                aria-label="Settings"
                onClick={onSettings}
                className="cg-state cg-focus"
                style={{ display: "grid", placeItems: "center", height: "var(--touch-target-min)", width: "var(--touch-target-min)", border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", marginLeft: "auto" }}
              >
                <Icon name="settings" />
              </button>
            )}
          </>
        ) : (
          <>
            <StanceControl targetLabel={"@" + handle} bundle={bundle ?? undefined} signedIn={signedIn} taught={taught} onCommit={onCommit} />
            {menuItems.length > 0 && (
              <div style={{ marginLeft: "auto" }}>
                <OverflowMenu items={menuItems} ariaLabel={"More about @" + handle} />
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
