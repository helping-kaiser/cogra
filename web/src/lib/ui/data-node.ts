// THE DESIGN'S NODE IDS, ON THE WEB. The built canonical boards name every
// meaningful element with a dot-path (`data-node="feed.card.authorChip"`), and
// the registry of those paths is `design/designs/canonical/nodes.json` — an
// APPEND-ONLY contract: a renamed path is a breaking change to every oracle
// that measures it. The web mirrors each registered path verbatim as the
// element's `data-testid`, so the conformance harness pairs a drawn element
// with a rendered one by name and never by DOM order.
//
// A REPEATED INSTANCE CARRIES A KEY (`data-node-key` on the board,
// `data-testid-key` here): the board keys its sample cards by content (`ada`),
// the web by the record's own id, and the harness states which stands in for
// which. EVERY NODE INSIDE A KEYED INSTANCE CARRIES THE COMPOSITE KEY, joined
// outermost first with `/` (`<post id>/1` for a card's first frame), exactly as
// the registry's note says — so a node's key is read off the node itself and
// never resolved from an ancestor.
//
// ONLY A REGISTERED SCREEN WEARS THESE. A shared component (the post card, the
// band, the bar) takes an optional node and keeps its old `data-testid` when it
// is handed none, so a surface whose screen is not registered yet renders
// exactly as before; it moves to the convention when its screen registers.

/** A registered node: its full dot-path and, inside an instance, its key. */
export type DataNode = {
  readonly path: string;
  readonly key?: string;
};

/** The attributes a node is rendered with. */
export type DataNodeAttributes = {
  "data-testid"?: string;
  "data-testid-key"?: string;
};

/**
 * The test attributes for an element: the node's when there is one, else the
 * element's own legacy id (or none).
 */
export function testAttributes(
  node: DataNode | undefined,
  legacy?: string,
): DataNodeAttributes {
  if (node === undefined) return { "data-testid": legacy };
  return node.key === undefined
    ? { "data-testid": node.path }
    : { "data-testid": node.path, "data-testid-key": node.key };
}

/** A part of a node — same instance, so the same key. */
export function part(node: DataNode, tail: string): DataNode;
export function part(node: DataNode | undefined, tail: string): DataNode | undefined;
export function part(node: DataNode | undefined, tail: string): DataNode | undefined {
  if (node === undefined) return undefined;
  return { path: `${node.path}.${tail}`, key: node.key };
}

/**
 * A repeated part of a node — its own instance, keyed by `key` under the
 * enclosing one (`<post id>/2`), or by `key` alone at the top level.
 */
export function instance(node: DataNode, tail: string, key: string): DataNode;
export function instance(
  node: DataNode | undefined,
  tail: string,
  key: string,
): DataNode | undefined;
export function instance(
  node: DataNode | undefined,
  tail: string,
  key: string,
): DataNode | undefined {
  if (node === undefined) return undefined;
  return {
    path: `${node.path}.${tail}`,
    key: node.key === undefined ? key : `${node.key}/${key}`,
  };
}
