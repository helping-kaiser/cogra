import React from "react";
import { MonogramAvatar, REDACTED_ACTOR_NAME } from "./ActorChip.jsx";
import { Button } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";

/* The profile header (backlog item 5) — specified in the source, never built (readme §7,
   *Intentional additions*).

   PEOPLE FIRST, AND A PERSON IS A TARGET. A profile is the one surface whose
   subject is a person, so the stance control on THEM leads the actions: the whole
   product is opinions on things, and a person is the most consequential thing to
   have one on. On a profile it wears the wide anchor — the row's one action,
   stretched to the row (jakob 2026-09-01, "the stance icon looks lost" at
   anchor size).

   THE ⋮ CLOSES THE ROW (the band law, jakob 2026-09-11). No band carries an
   overflow any more and a detail surface's header gives one back to the page
   it belongs to, so this row ends with the page's own dot: on your own profile
   after Edit profile and Invites, on someone else's after Message. A profile's
   rarer acts — mention, share, save, hide — are the page's, not the shell's,
   and they now sit a thumb's width from the things they act beside.

   MESSAGE IS SIZED BY ITS WORD, NOT BY THE ROW (jakob: "the message button
   already is so wide.. with quite a lot of padding"). Splitting the row in
   half gave one word a button the length of a paragraph; the room it gives
   back is what the ⋮ costs. THE ROW IS STILL MODE-INVARIANT — the rule
   `ProfileOtherHeld` was drawn to record. Message takes its content width in
   both reading modes and the anchor takes the remainder, so the exact pair a
   geek reader turns on paints INSIDE the anchor's own space and nothing in the
   row moves. Sizing Message by content makes that stronger than `flex: 1`
   did: a width derived from one word cannot depend on what the anchor says.

   THE SHAPE IS THE COMPACT ONE (jakob 2026-09-01): avatar left, the name and
   the figures in the column beside it — the layout every social profile has
   taught readers to parse — then bio, then the one actions row. Tight: the
   header is a summary, not a hero.

   THE COUNTS ARE THE HARD PART, and the difficulty is accuracy rather than
   vocabulary. What links two people here carries an opinion and has a direction,
   so a single number would have to pick one of those facts and hide the other.
   The header counts what a reader can actually place instead: how many people
   have given an opinion on this person, and how many this person has given. Two
   figures, each labelled, each plain — never one merged "followers" number,
   because there is no following here and borrowing the word would describe a
   different product. A Posts figure leads the row, and the figures are one tap
   target leading to the opinions page: both directions, separated, never merged
   there either.

   THE AVATAR CHANGES WITHOUT THE EDIT SCREEN (jakob 2026-09-01). Changing the
   picture is frequent and mostly standalone, so one's own avatar wears a change
   badge right here — the same signed act, the same crop-and-seal flow the edit
   screen reaches; the edit screen keeps its row too. THE AVATAR ITSELF IS NOT
   TAPPABLE (the K13 round): the badge is the door, and the picture is a
   picture.

   BOTH DOORS ANSWER TO 48px (readme §4, the K13 round): the 28px badge and the
   figures row (about 40px of ink) carry `cg-hit`, which grows each target
   without moving a pixel of the drawing. The floor is ruled.

   No cover image, no banner: the system has no imagery slot that size, and a
   decorative band would be the largest thing on a screen whose subject is a
   person's record.

   It is not a card. It is the top of a screen, on the page ground — a card would
   imply a second card beside it.

   A DELETED ACCOUNT KEEPS THIS WHOLE HEADER (`redacted`, the redacted-actor
   law, jakob 2026-09-11). The shells never go: an actor whose identity payloads
   were removed is still an actor, still the author of everything it signed,
   still carrying the standing others vouched into it (`erasure.md` §2–3) — so
   the header it gets is this one, with the counts it really has, and only the
   personal data placeholdered. The avatar becomes the reserved disc, the name
   slot takes `ActorChip`'s one word in the system's own voice, the handle is
   dropped rather than invented, and `bio` takes the redaction mark in the place
   the bio's words were. Drawing a stripped-down page instead would be the
   product pretending less was there than there was, which is the one thing the
   erasure ethic forbids. */

/* The header's one stylesheet: the figures' second arrangement, under the
   avatar-and-name block, below each profile's measured fit (the header's
   width under 96px of avatar and gap plus 15.5rem of another's labels, or
   14.5rem of one's own). The name centres on the avatar there, and the
   figures keep the header's own 12px gap. */
const UNDER = `{ .cg-profile-grid { grid-template-areas: "avatar name" "figures figures" !important } .cg-profile-name { align-self: center !important } .cg-profile-figures { margin-top: var(--space-3) !important } }`;
const PROFILE_TOP_CSS = `@container cg-profile-other (width < calc(96px + 15.5rem)) ${UNDER} @container cg-profile-own (width < calc(96px + 14.5rem)) ${UNDER}`;

function Figure({ value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>{value}</span>
      <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

export function ProfileHeader({
  handle,
  displayName,
  avatarSrc,
  bio,
  website,
  posts,
  stancesOn,
  stancesTaken,
  own = false,
  signedIn = true,
  taught = true,
  bundle,
  onCommit,
  onMessage,
  onEdit,
  onInvites,
  onAvatarChange,
  onCounts,
  menu,
  invitesWaiting = false,
  /* AN APPLICANT'S INVITES IS LOCKED, NOT GONE (jakob 2026-10-02; auth.md's
     locked look, the comment foot's pattern): the button stands at the
     disabled opacity and stays tappable, the tap answering `You can invite
     once you're in.` The value is the opacity itself, as `CommentCard`'s
     `replyOpacity` is. */
  invitesOpacity,
  redacted = false,
  showHandle = true,
}) {
  const name = redacted ? REDACTED_ACTOR_NAME : displayName && displayName.trim() ? displayName : handle;
  const hasFigures = posts !== undefined || stancesOn !== undefined || stancesTaken !== undefined;
  const figures = (
    <>
      {posts !== undefined && <Figure value={posts} label="Posts" />}
      {stancesOn !== undefined && <Figure value={stancesOn} label={own ? "Opinions on you" : "Opinions on them"} />}
      {stancesTaken !== undefined && <Figure value={stancesTaken} label={own ? "Opinions by you" : "Opinions by them"} />}
    </>
  );
  /* THE FIGURES MOVE UNDER WHEN THEY DO NOT FIT (the K13 round; readme §4,
     *Type*). Three labels that never wrap need about 243px for another's
     profile and 228px for one's own at 1× — and the column beside the avatar
     is 262px at 390, 232 at 360, 192 at 320, measured. So while the figures fit
     that column at their rendered size they stand under the name, and where
     they do not they move under the avatar-and-name block, the header's full
     width. One grid, two arrangements: the avatar spans the name's row and
     the figures' row while they fit, and the figures take the second row's
     full width when they do not. The switch is a container query on the
     header's own width — 96px of avatar and gap plus the labels' measured
     width in `rem`, so it moves with the reader's text size. */
  const container = own ? "cg-profile-own" : "cg-profile-other";
  /* THE NAME CARRIES WHAT THE EYE READS (readme §10, K13.11): the figures'
     visible words and numbers first, then the door's purpose — the filter
     pill's reading-before-purpose order (`triggerName`). */
  const figuresReading = [
    posts !== undefined && `${posts} Posts`,
    stancesOn !== undefined && `${stancesOn} ${own ? "Opinions on you" : "Opinions on them"}`,
    stancesTaken !== undefined && `${stancesTaken} ${own ? "Opinions by you" : "Opinions by them"}`,
  ].filter(Boolean).join(", ");
  const figuresPurpose = own ? "your opinions, both directions" : redacted ? "opinions on and by this account" : "opinions on and by @" + handle;
  const figuresCell = hasFigures
    ? onCounts
      ? (
        <button
          type="button"
          aria-label={`${figuresReading}, ${figuresPurpose}`}
          onClick={onCounts}
          className="cg-state cg-focus cg-hit cg-profile-figures"
          style={{ gridArea: "figures", alignSelf: "start", display: "flex", gap: "var(--space-5)", border: 0, background: "none", padding: 0, marginTop: 6, cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left", width: "fit-content", maxWidth: "100%", borderRadius: "var(--radius-small)" }}
        >
          {figures}
        </button>
      )
      : <div className="cg-profile-figures" style={{ gridArea: "figures", alignSelf: "start", display: "flex", gap: "var(--space-5)", marginTop: 6 }}>{figures}</div>
    : null;
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-3) 0 var(--space-1)" }}>
      <style dangerouslySetInnerHTML={{ __html: PROFILE_TOP_CSS }} />
      <div style={{ containerType: "inline-size", containerName: container }}>
      <div className="cg-profile-grid" style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gridTemplateAreas: '"avatar name" "avatar figures"', columnGap: "var(--space-4)", alignItems: "center" }}>
        <div style={{ gridArea: "avatar", position: "relative", flex: "none" }}>
          <MonogramAvatar name={name} size={80} src={avatarSrc} redacted={redacted} />
          {own && onAvatarChange && (
            <button
              type="button"
              aria-label="Change your picture"
              onClick={onAvatarChange}
              className="cg-state cg-focus cg-hit"
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                display: "grid",
                placeItems: "center",
                height: 28,
                width: 28,
                border: "2px solid var(--surface)",
                background: "var(--secondary-container)",
                color: "var(--on-secondary-container)",
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Icon name="photo_camera" size={16} />
            </button>
          )}
        </div>
        <div className="cg-profile-name" style={{ gridArea: "name", alignSelf: "end", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: "var(--text-title-large--font-weight)", overflowWrap: "anywhere", color: redacted ? "var(--text-secondary)" : undefined }}>{name}</h1>
          {/* The handle repeats only where the screen's top bar does not already
              carry it — a drill-in is titled @handle, so it passes showHandle
              false (jakob 2026-09-01). A redacted actor has none to repeat. */}
          {showHandle && !redacted && <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>@{handle}</span>}
        </div>
        {figuresCell}
      </div>
      </div>
      {/* The bio slot takes a node as readily as a string: where the words were
          removed, the redaction mark stands in their place rather than the slot
          collapsing — a space kept, not a space lost. */}
      {bio && (typeof bio === "string" ? <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{bio}</p> : bio)}
      {website && <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--primary)", overflowWrap: "anywhere" }}>{website}</span>}
      {/* The actions row. On someone else's profile the opinion leads and
          Message stands beside it, the pair every social profile puts here
          (jakob 2026-09-01) — the opinion where Follow goes, the chat one tap
          away. On your own there is no opinion to give, so the row is the two
          things you do to your own record. The page's ⋮ closes the row in
          either case. The widths: the opinion takes what is left, Message takes
          its word, and your own two buttons share what the dot leaves. */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {own ? (
          <>
            {onEdit && <Button variant="outline" size="sm" onClick={onEdit} style={{ flex: 1 }}>Edit profile</Button>}
            {onInvites && (
              <Button
                variant="outline"
                size="sm"
                onClick={onInvites}
                ariaLabel={invitesWaiting ? "Invites — someone is waiting" : undefined}
                style={invitesOpacity !== undefined ? { flex: 1, opacity: invitesOpacity } : { flex: 1 }}
              >
                Invites
                {/* THE WAITING MARK IS THE BELL'S DOT (the invites round,
                    2026-09-15). An application that has become approvable is
                    waiting on this person and on nobody else, so the one place
                    it can be learned is the row that opens the queue. It is a
                    DOT and not a count, the bell's own ruling reused rather
                    than a second badge vocabulary invented beside it — what
                    the button honestly says is "something is waiting", and the
                    list two taps away is where the number belongs. `--primary`
                    at 8px, `ContentRow`'s unread geometry, and the button's
                    accessible name changes with it: a marker a listener cannot
                    hear is not a marker. */}
                {invitesWaiting && (
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, flex: "none", borderRadius: "var(--radius-full)", background: "var(--primary)" }}
                  />
                )}
              </Button>
            )}
          </>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* The target's name, except where there is none left to print:
                  a redacted actor's handle went with the rest of its identity,
                  and naming it back here would undo the redaction in the one
                  string a screen reader reads aloud. */}
              <StanceControl wide targetLabel={redacted ? "this account" : "@" + handle} bundle={bundle ?? undefined} signedIn={signedIn} taught={taught} onCommit={onCommit} />
            </div>
            {onMessage && (
              <Button variant="outline" onClick={onMessage} style={{ flex: "none" }}>
                Message
              </Button>
            )}
          </>
        )}
        {menu}
      </div>
    </header>
  );
}
