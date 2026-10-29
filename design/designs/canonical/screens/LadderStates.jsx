/* The post ladder — the marked states: veiled, and the two removals.

   THE `source` CHIP DRAWS WHOSE MARK THE VEIL NAMES (Q47; round 27, seam 252,
   item 7): `author` — `The author's warning — One rubbing includes a dead
   seabird.`; `platform` — `The platform's verdict`, the verdict's reason after
   an em dash where it carries one; `both` — the two independent states
   standing at once (moderation.md, *Two independent states*), the author's
   line first and the verdict in the edit's blessed words after it: `The
   author's warning — One rubbing includes a dead seabird. Also veiled by the
   platform's verdict`. The server names the case (`sensitiveSource`, the
   contract ask); until it does, a client reads the author's line alone. */
export const PROPS = { source: { editor: "enum", options: ["author", "platform", "both"], default: "author" } };
export const VALS = `authorShown: this.props.source === "author" ? "contents" : "none", platformShown: this.props.source === "platform" ? "contents" : "none", bothShown: this.props.source === "both" ? "contents" : "none"`;

const REASON = "One rubbing includes a dead seabird.";
const VEILED = (sensitive) => (
  <PostCard
    author={SOL}
    title="Salt maps of the coast road"
    description="Rubbings from three weekends at low tide — paper against the salt crust."
    timestamp="3d"
    media={[{ src: "post-photo.jpg", ratio: "wide", fit: "cover" }]}
    sensitive={sensitive}
    score="9.10"
    comments={2}
    bundle={null}
    license={{ attribution: 0.5, provenance: 0.5 }}
    menuItems={CARD_MENU}
  />
);

export function Screen() {
  return (
    <>
      <CograBand />
      <FeedList>
        <div style={{ display: "{{authorShown}}" }}>{VEILED({ reason: REASON })}</div>
        <div style={{ display: "{{platformShown}}" }}>{VEILED({ source: "platform" })}</div>
        <div style={{ display: "{{bothShown}}" }}>{VEILED({ reason: REASON, source: "both" })}</div>
        {/* A redacted record keeps its menu — the license rode the payload and is
            gone, but the record can still be cited: it never left the graph. */}
        <PostCard author={ADA} timestamp="7d" redacted={{ reason: "author" }} score="15.20" comments={3} menuItems={CARD_MENU} />
        <PostCard author={TOBIAS} timestamp="14d" redacted={{ reason: "illegal" }} score="4.70" comments={1} menuItems={CARD_MENU} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
