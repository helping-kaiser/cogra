/* INVITES — the live state (the invites round, 2026-09-15). What the Invites
   button on your own profile opens, and where the dot on that button sends a
   reader: the applications waiting and the links still usable, in that order.

   THE PAGE IS `InvitesBody`, in `_shared.jsx`: the create sheet, the expiry
   chooser, the fresh link, the approval pad and the reject dialog are all
   drawn over this same page. Six boards, one drawing.

   IT CARRIES NO BOTTOM BAR. `BottomNav`'s own rule names invites among the
   task flows — compose, profile edit, settings, key and auth — that take a
   `PageHeader` back arrow instead. The rule predates this round and this board
   keeps it: a surface a reader came to in order to finish something offers the
   way back, not four ways out.

   THE TWO HALVES MUST NOT LOOK ALIKE, and here they do not. Staging is free
   and revocable: a link is a thing the reader made and can un-make with one
   quiet word, and its card is the long-opaque-string card the wallet's payout
   address already is. Vouching is signed and priced: it happens on the pad, in
   the pad's own grammar, and nothing on this page can do it by accident.

   THE `kept` CHIP DRAWS A KEPT APPROVAL (jakob 2026-10-05, the final brief):
   `waiting` puts the vouch the reader set on @noor's ask link, kept while the
   key was elsewhere, at the head of Applications as its own row reading
   `Waiting for your key` (`KeptApprovalRow`). Once the key is back it reads
   `Ready for your approval`, and it is the row the kept picks' line `An
   approval waits in your invites.` sends the reader to.

   THE `revoke` CHIP DRAWS A REVOKE IN FLIGHT (the check round's Q10, jakob
   2026-10-06): `waiting` is the first link's card past 200ms after its
   Revoke — the card holds and the word reads `Revoking…`, inert and never
   dimmed, because a revoke is a consequential write and waits like one. When
   it lands the card leaves with `Invite revoked`; a failure keeps the card
   with the standard failure answer.

   THE `letIn` CHIP'S `more` AND `more-opened` DRAW THE CAP (jakob 2026-11-11,
   round 40): five people let in, three shown, the newest, then `Show all`
   under the third (`more`); the door opens the rest in place (`more-opened`).
   THE `sections` CHIP'S `only-let-in` draws a page where nothing waits and no
   link is live but someone was let in: not the empty state — `New invite` and
   `People you let in` stand, the two empty sections gone.

   THE `applications` CHIP DRAWS THE QUEUE'S CAP (jakob 2026-11-11 and
   2026-11-12, backlog 180): `capped`, the default, is the first three rows
   in the queue's grouped order — `@imke`, `@vora81`, `@vora82` under Many
   uses — and `Show all` under the third, People you let in's door; `opened`
   the whole queue in place. A kept approval (`kept`) stands above the three.
   The `asker` chip's `deleted` draws the queue opened, its row being the
   fourth.

   REGISTERED under the `invites` prefix (design ⇄ impl seam 078, the invites
   packet): the body names its parts, and `NODE` carries them onto the built
   board and into `nodes.json`. The `revoke` chip's two copies of the first
   link's card are one `invites.link` under the link's own id (ruling 39). */
export const NODE = "invites";
export const PROPS = {
  kept: { editor: "enum", options: ["none", "waiting"], default: "none" },
  revoke: { editor: "enum", options: ["rest", "waiting"], default: "rest" },
  sections: { editor: "enum", options: ["both", "no-applications", "no-links", "only-let-in"], default: "both" },
  asker: { editor: "enum", options: ["named", "deleted"], default: "named" },
  copy: { editor: "enum", options: ["rest", "failed"], default: "rest" },
  letIn: { editor: "enum", options: ["none", "people", "deleted", "more", "more-opened"], default: "none" },
  applications: { editor: "enum", options: ["capped", "opened"], default: "capped" },
};
export const VALS = `applicationsDoorShown: this.props.applications === "opened" || this.props.asker === "deleted" ? "none" : "block", applicationsRestShown: this.props.applications === "opened" || this.props.asker === "deleted" ? "flex" : "none", keptShown: this.props.kept === "waiting" && this.props.sections !== "only-let-in" ? "block" : "none", revokeRestShown: this.props.revoke === "waiting" ? "none" : "block", revokeBusyShown: this.props.revoke === "waiting" ? "block" : "none", applicationsSectionShown: this.props.sections === "only-let-in" ? "none" : "flex", linksSectionShown: this.props.sections === "only-let-in" ? "none" : "flex", applicationsShown: this.props.sections === "no-applications" ? "none" : "flex", applicationsEmptyShown: this.props.sections === "no-applications" ? "block" : "none", linksShown: this.props.sections === "no-links" ? "none" : "flex", linksEmptyShown: this.props.sections === "no-links" ? "block" : "none", askerNamedShown: this.props.asker === "deleted" ? "none" : "flex", askerDeletedShown: this.props.asker === "deleted" ? "flex" : "none", copyFailedShown: this.props.copy === "failed" ? "block" : "none", peopleShown: this.props.letIn === "none" && this.props.sections !== "only-let-in" ? "none" : "flex", personNamedShown: this.props.letIn === "deleted" ? "none" : "flex", personDeletedShown: this.props.letIn === "deleted" ? "flex" : "none", personMoreShown: this.props.letIn === "more" || this.props.letIn === "more-opened" ? "flex" : "none", peopleDoorShown: this.props.letIn === "more" ? "flex" : "none", personRestShown: this.props.letIn === "more-opened" ? "flex" : "none"`;

export function Screen() {
  return (
    <InvitesBody
      kept="{{keptShown}}"
      revoke={{ rest: "{{revokeRestShown}}", busy: "{{revokeBusyShown}}" }}
      shown={{
        applications: "{{applicationsShown}}",
        applicationsEmpty: "{{applicationsEmptyShown}}",
        links: "{{linksShown}}",
        linksEmpty: "{{linksEmptyShown}}",
        askerNamed: "{{askerNamedShown}}",
        askerDeleted: "{{askerDeletedShown}}",
        copyFailed: "{{copyFailedShown}}",
        people: "{{peopleShown}}",
        personNamed: "{{personNamedShown}}",
        personDeleted: "{{personDeletedShown}}",
        personMore: "{{personMoreShown}}",
        peopleDoor: "{{peopleDoorShown}}",
        personRest: "{{personRestShown}}",
        applicationsSection: "{{applicationsSectionShown}}",
        applicationsDoor: "{{applicationsDoorShown}}",
        applicationsRest: "{{applicationsRestShown}}",
        linksSection: "{{linksSectionShown}}",
      }}
    />
  );
}
