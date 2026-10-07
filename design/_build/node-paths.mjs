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
// A CHIP-DRAWN STATE DUPLICATE carries the SAME path, with its chip's value as
// its key (jakob 2026-10-06, seam 069). Where a board's tweak chip draws an
// element once per value — one copy shown at a time, `HistoryNone`'s `cause`
// chip drawing the field, the trigger and the empty state once for `search`
// and once for `kinds` — the copies are one element in two states, so they
// take one path and the differ tells them apart by key: `history.searchField`
// under `search` and under `kinds`. The screen marks each copy where it draws
// it, on the element that holds that value's copy and nothing else:
// `data-node-chip="cause" data-node-key="search"`, with no `data-node` — a copy
// adds no segment. The value must be one of the chip's options (the screen's
// PROPS), every node inside the copy carries it as a key like any keyed
// instance's, and the copy's outermost nodes record the chip rule as their key
// rule. The marker itself never reaches the built board.
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
const STRIP = / data-node(?:-key|-chip)?="[^"]*"/g;

// How each keyed instance's key is derived — the rule the implementation side
// computes the same key from. Keyed by the instance's own segment; a keyed
// node whose segment has no rule here fails the build, so no key ships
// without its rule written down.
export const KEY_RULES = {
  account: "the hidden account's handle, without @ (the hidden-accounts sheet)",
  act: "the act's position in the chronicle, newest first, counted from 1 (the profile's chronicle)",
  application: "the applicant's handle, without @ (Invites' applications, a kept approval's row among them)",
  card: "the author's handle, without @ (PostCard)",
  commentCard: "the comment author's handle, without @ (CommentCard)",
  day: "the divider's words, lowercased, each run of other characters one - (History's day dividers)",
  entry: "the saved thing's title, or an untitled post's stand-in (a words post's first line, a media post's kind and author's handle: Pictures by @ada, A video by @ada), lowercased, each run of other characters one - (Saved)",
  frame: "the picture's position in the post's media, counted from 1 (MediaGallery)",
  group: "the id of the invite link its applications came through, the link's last path segment (Invites' application groups)",
  profileCard: "the person's handle, without @ (the profile feed card)",
  recent: "the recent query's words, lowercased, each run of other characters one -, none leading or trailing (Explore's recents)",
  result: "the result's position in the results, counted from 1, the rows past the seam counting on (Explore's search)",
  tag: "the tag's name, without # (TopicsLine, TopicRemovable)",
  tagCard: "the tag's name, without # (the tag feed card)",
  topic: "the topic's title, lowercased, each run of other characters one -, none leading or trailing (About's topics)",
  thumb: "the picture's position in the draft's media, counted from 1 (PickedRow)",
  tier: "the reading's position on its license axis, the least asked first, counted from 1 (LicenseAxis)",
  session: "the session's position in the list, this device first, counted from 1 (Settings' sessions)",
  stagedReference: "the reference's position in the staged set, counted from 1 (the screen that stages it)",
};

// The key rule of a chip-drawn state duplicate (above): one rule for every
// chip, named by the chip, since the key is the chip's value wherever it is.
export const chipKeyRule = (chip) =>
  `the ${chip} chip's value — the board draws this once per value, one shown at a time (a chip-drawn state duplicate)`;

export const isSegment = (s) => SEGMENT.test(s);

/** Every node attribute out of markup that belongs to no registered screen. */
export function stripNodes(markup) {
  return markup.replace(STRIP, "");
}

/**
 * Joins a registered screen's local segments into full paths. `chips` is the
 * screen's PROPS (its tweak chips), which a chip-drawn copy's value is held to.
 * Returns the rewritten markup and the nodes in document order: { path, key }.
 */
export function joinNodePaths(markup, prefix, board, chips = null) {
  const fail = (why) => {
    throw new Error(`data-node join, ${board}: ${why}`);
  };
  if (!SEGMENT.test(prefix)) fail(`NODE "${prefix}" is not a camelCase segment`);
  const stack = [{ tag: null, path: [prefix], keys: [], chipRule: null }];
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
    let chip;
    for (const [, name, value] of attrs.matchAll(ATTR)) {
      if (name === "data-node") seg = value;
      else if (name === "data-node-key") key = value;
      else if (name === "data-node-chip") chip = value;
    }
    let frame = { tag, path: parent.path, keys: parent.keys, chipRule: parent.chipRule };
    if (chip !== undefined) {
      // A chip-drawn copy: no segment, its chip's value as the key of all inside.
      if (seg !== undefined) fail(`<${tag}> carries data-node-chip="${chip}" and data-node="${seg}" — a chip-drawn copy adds no segment`);
      const options = chips?.[chip]?.options;
      if (!Array.isArray(options)) fail(`data-node-chip="${chip}" names no chip the screen's PROPS draws with options`);
      if (key === undefined || !options.includes(key)) fail(`the ${chip} chip's copy carries data-node-key="${key ?? ""}" — the key is one of its values: ${options.join(", ")}`);
      if (!KEY.test(key)) fail(`the ${chip} chip's value "${key}" cannot be a key — a key is lowercase letters, digits, - and _`);
      if (parent.chipRule !== null) fail(`the ${chip} chip's copy sits inside another chip's copy with no node between them`);
      out += markup.slice(last, m.index) + `<${tag}${attrs.replace(STRIP, "")}${selfClose ? "/" : ""}>`;
      last = m.index + whole.length;
      frame = { tag, path: parent.path, keys: [...parent.keys, key], chipRule: chipKeyRule(chip) };
    } else if (seg !== undefined || key !== undefined) {
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
      if (key !== undefined && parent.chipRule !== null) {
        fail(`keyed ${seg} sits directly in a chip-drawn copy — one path cannot record two key rules; name a node around it`);
      }
      nodes.push({ path: full, key: chain || null, rule: key === undefined ? parent.chipRule : KEY_RULES[seg] });
      const rest = attrs.replace(STRIP, "");
      const rewritten = `<${tag}${rest} data-node="${full}"${chain ? ` data-node-key="${chain}"` : ""}${selfClose ? "/" : ""}>`;
      out += markup.slice(last, m.index) + rewritten;
      last = m.index + whole.length;
      frame = { tag, path, keys, chipRule: null };
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
