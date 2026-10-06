// The data-node join (design ⇄ impl seam 002): the implementation side's
// conformance harness diffs the BUILT boards element by element, and needs
// every element it names to carry a stable identity. The identity is split
// where the markup is written, and joined here, after render:
//
// - A MASTER names its own parts with LOCAL segments — `data-node="face"` on
//   the stance control's face — and names nothing unless its placer named it:
//   every annotated master takes a `node` prop, and its parts' segments only
//   render when that prop is set. So a master placed without a name stays
//   silent, and its parts can never attach to the wrong ancestor.
// - The PLACER names what it places: `<PostCard node="card" />`.
// - The SCREEN supplies the prefix: a registered screen exports `NODE`
//   (`export const NODE = "feed";`), and only a registered screen keeps its
//   annotations — every other board renders with them stripped, so a name
//   reaches a built board only once it is registered in `nodes.json`.
//
// The join walks the rendered markup and rewrites each segment to its full
// path: the prefix, then the segment of every annotated ancestor, outermost
// first — `feed` + `card` + `actionRow` + `score` = `feed.card.actionRow.score`.
// A repeated instance carries `data-node-key` (a stable content key, never DOM
// order where content has one), and every node inside it carries the same key,
// so each node's two attributes are its whole identity: nested keyed
// instances join their keys outermost first with `/` (`ada/photography`).
// Two nodes with one (path, key) on one board fail the build.
//
// Because a path follows the annotated ancestry, two rules keep paths stable
// once registered. A wrapper that holds named nodes is named when they are, or
// never: naming it later renames every node inside it, which render-screens'
// append-only guard refuses. And no node wraps named content in only some
// states — a veil drawn around a gallery would move the gallery's paths with
// the state; an element like that is named as a leaf beside what it covers.
//
// The markup is React's static render, which is regular enough to walk with a
// tokenizer: every non-void element is closed, attribute values are quoted and
// escaped (no raw `<`, `>` or `"` inside one), and no comments are emitted. The
// walk is strict anyway — a close tag that does not match its open tag, or a
// board that ends with elements open, throws with the board's name, so markup
// the walk cannot read fails loudly instead of yielding wrong paths.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const SEGMENT = /^[a-z][a-zA-Z0-9]*$/;
const KEY = /^[a-z0-9][a-z0-9_-]*$/;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:="[^"]*")?)*)\s*(\/?)>/g;
const ATTR = /\s+([^\s"'>/=]+)(?:="([^"]*)")?/g;
const STRIP = / data-node(?:-key)?="[^"]*"/g;

// How each keyed instance's key is derived — the rule the implementation side
// computes the same key from. Keyed by the instance's own segment; a keyed
// node whose segment has no rule here fails the build, so no key ships
// without its rule written down.
export const KEY_RULES = {
  act: "the act's position in the chronicle, newest first, counted from 1 (the profile's chronicle)",
  card: "the author's handle, without @ (PostCard)",
  commentCard: "the comment author's handle, without @ (CommentCard)",
  entry: "the saved thing's title, lowercased, each run of other characters one - (Saved)",
  frame: "the picture's position in the post's media, counted from 1 (MediaGallery)",
  tag: "the tag's name, without # (TopicsLine, TopicRemovable)",
  thumb: "the picture's position in the draft's media, counted from 1 (PickedRow)",
  stagedReference: "the reference's position in the staged set, counted from 1 (the screen that stages it)",
};

export const isSegment = (s) => SEGMENT.test(s);

/** Every node attribute out of markup that belongs to no registered screen. */
export function stripNodes(markup) {
  return markup.replace(STRIP, "");
}

/**
 * Joins a registered screen's local segments into full paths.
 * Returns the rewritten markup and the nodes in document order: { path, key }.
 */
export function joinNodePaths(markup, prefix, board) {
  const fail = (why) => {
    throw new Error(`data-node join, ${board}: ${why}`);
  };
  if (!SEGMENT.test(prefix)) fail(`NODE "${prefix}" is not a camelCase segment`);
  const stack = [{ tag: null, path: [prefix], keys: [] }];
  const nodes = [];
  const seen = new Map();
  let out = "";
  let last = 0;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(markup))) {
    const [whole, close, tag, attrs, selfClose] = m;
    if (close) {
      const top = stack.pop();
      if (!top || top.tag !== tag) fail(`</${tag}> closes <${top?.tag ?? "nothing"}> at offset ${m.index}`);
      continue;
    }
    const parent = stack[stack.length - 1];
    let seg;
    let key;
    for (const [, name, value] of attrs.matchAll(ATTR)) {
      if (name === "data-node") seg = value;
      else if (name === "data-node-key") key = value;
    }
    let frame = { tag, path: parent.path, keys: parent.keys };
    if (seg !== undefined || key !== undefined) {
      if (seg === undefined) fail(`<${tag}> carries data-node-key="${key}" and no data-node`);
      if (!SEGMENT.test(seg)) fail(`data-node="${seg}" is not one camelCase segment`);
      if (key !== undefined && !KEY.test(key)) fail(`data-node-key="${key}" on ${seg} — a key is lowercase letters, digits, - and _`);
      if (key !== undefined && !(seg in KEY_RULES)) fail(`${seg} is keyed but KEY_RULES names no rule for it`);
      const path = [...parent.path, seg];
      const keys = key === undefined ? parent.keys : [...parent.keys, key];
      const full = path.join(".");
      const chain = keys.join("/");
      const identity = `${full}\u0000${chain}`;
      if (seen.has(identity)) {
        fail(
          chain
            ? `two nodes share path ${full} and key ${chain} — the instances' key rule does not tell them apart`
            : `two nodes share path ${full} with no key — a repeated instance needs a data-node-key`,
        );
      }
      seen.set(identity, true);
      nodes.push({ path: full, key: chain || null, rule: key === undefined ? null : KEY_RULES[seg] });
      const rest = attrs.replace(STRIP, "");
      const rewritten = `<${tag}${rest} data-node="${full}"${chain ? ` data-node-key="${chain}"` : ""}${selfClose ? "/" : ""}>`;
      out += markup.slice(last, m.index) + rewritten;
      last = m.index + whole.length;
      frame = { tag, path, keys };
    }
    if (!selfClose && !VOID.has(tag)) stack.push(frame);
  }
  if (stack.length !== 1) fail(`${stack.length - 1} element(s) left open at the end of the board`);
  return { markup: out + markup.slice(last), nodes };
}

/**
 * The registry entry for one board: the key rule of every keyed instance, and
 * every path in sorted order with the keys it renders under (document order;
 * empty for a node outside any keyed instance).
 */
export function boardEntry(prefix, nodes) {
  const byPath = new Map();
  const rules = new Map();
  for (const { path, key, rule } of nodes) {
    if (!byPath.has(path)) byPath.set(path, []);
    if (key !== null) byPath.get(path).push(key);
    if (rule !== null) rules.set(path, rule);
  }
  const sorted = (map) => Object.fromEntries([...map.keys()].sort().map((p) => [p, map.get(p)]));
  return { prefix, keys: sorted(rules), nodes: sorted(byPath) };
}
