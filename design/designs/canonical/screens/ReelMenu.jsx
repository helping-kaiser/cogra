/* THE STREAM, ITS ⋮ OPEN (jakob 2026-11-13, M2: "as rec we add the dots").
   The rail's ⋮ raises the clip's post menu over the stream — the card's own
   sheet, row for row: the reader's post menu (`readerPostMenu`, the Hide row
   naming the clip's author) or, on the reader's own clip, the own post menu
   (`OWN_POST_MENU`). The stream adds no row and takes none away: it is a way
   of reading the list, and a post's menu is one menu wherever it is opened.

   WHAT DIFFERS IS BENEATH. The sheet rises over `Reel`'s playing stream, the
   clip, its rail and caption standing under the sheet's wash — as the
   comments sheet rises over the clip. A row that leaves the stream (Cite,
   Edit, Remove's dialog, the readings, the license, Report) answers as it
   answers on any host; closing the sheet leaves the stream as it was.

   THE `whose` CHIP DRAWS THE TWO MENUS. `reader` is @mira's clip and the
   reader's post menu; `own` is the same clip as the reader's own, @sol's —
   the rail's author and the caption's handle with it — and the own post
   menu, no Hide and no Report (the own menus' rule).

   REGISTERED under `reel`, as every state board of the stream joins its
   prefix (round 26, seam 250): the sheet is `menuSheet`, one name per row,
   the rows' own names — the menus' law, whatever host raises them. The
   stream beneath is named as `Reel` names it, each chip copy keyed by its
   value. */
export const NODE = "reel";
export const PROPS = {
  whose: { editor: "enum", options: ["reader", "own"], default: "reader" },
};
export const VALS = `readerShown: this.props.whose === "own" ? "none" : "contents", ownShown: this.props.whose === "own" ? "contents" : "none"`;

const OWN_CLIP_POST = { ...MIRA_CLIP_POST, author: SOL };
const whoseCopy = (value) => ({ "data-node-chip": "whose", "data-node-key": value });

function StreamChrome({ post, avatar }) {
  return (
    <>
      <ReelRail
        node="rail"
        author={{ handle: post.author.handle, displayName: post.author.displayName, src: avatar }}
        score={post.score}
        comments={post.comments}
        bottom={BAND_HEIGHT + 96}
      />
      <ReelCaption node="caption" handle={post.author.handle} title={post.title} description={post.description} bottom={BAND_HEIGHT + 66} />
    </>
  );
}

export function Screen() {
  return (
    <>
      <div data-theme="dark" style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }} data-node="stage">
          <img
            src="clip-lakeside.jpg"
            alt="A man standing at the edge of a lake as the light drops."
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140, background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))" }}
          data-node="washTop"
        />
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 260, background: "linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))" }}
          data-node="washBottom"
        />

        <MediaDisc label="Back to feed" glyph="arrow_back" corner="top-left" onClick={() => {}} node="backDisc" />
        <MediaDisc label="Turn sound on" glyph="volume_off" corner="top-right" pressed={false} onClick={() => {}} node="soundDisc" />

        <div style={{ display: "{{readerShown}}" }} {...whoseCopy("reader")}>
          <StreamChrome post={MIRA_CLIP_POST} avatar="inviter.jpg" />
        </div>
        <div style={{ display: "{{ownShown}}" }} {...whoseCopy("own")}>
          <StreamChrome post={OWN_CLIP_POST} />
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: BAND_HEIGHT + 4, zIndex: 3 }}>
          <SeekLine progress={0.34} elapsed="0:14" duration="0:41" node="seekLine" />
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 4 }}>
          <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
        </div>
      </div>

      <BottomSheet open ariaLabel="Post actions" node="menuSheet">
        <div style={{ display: "{{readerShown}}", flexDirection: "column" }} {...whoseCopy("reader")}>
          {readerPostMenu("mira").map((item) => (
            <SheetItem key={item.label} label={item.label} node={item.node} />
          ))}
        </div>
        <div style={{ display: "{{ownShown}}", flexDirection: "column" }} {...whoseCopy("own")}>
          {OWN_POST_MENU.map((item) => (
            <SheetItem key={item.label} label={item.label} node={item.node} />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
