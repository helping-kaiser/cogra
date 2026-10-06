// The design's data-node ids, worn as Compose testTags (the implementation
// charter's STABLE-ID LAW; the design ⇄ impl seam 002 that registers them in
// `design/designs/canonical/nodes.json`).

package com.cogra.core.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId

/**
 * One element a registered design screen names.
 *
 * **Every meaningful element of a registered screen carries the design's
 * `data-node` path as its testTag, verbatim** — `feed.card.authorChip.avatar`
 * — so the conformance harness pairs the built screen with the drawn board by
 * id rather than by tree shape. The paths are an append-only contract owned
 * by the registry: renaming one breaks the harness, so a path is only ever
 * spelled the way `nodes.json` spells it.
 *
 * A Compose node carries ONE testTag, so an instance root's key rides in the
 * tag after [KEY_SEPARATOR] (`feed.card:<post id>`). Its parts carry the bare
 * path and take the key from the instance they sit in — the board's own
 * (path, key) model, where a part inside a keyed card is named by the card.
 *
 * A component that a registered screen names takes an optional `node`, the
 * way the design's own components take a `node` prop: given one, it wears the
 * registered paths; given none, it keeps the tags the surfaces that are not
 * registered yet still bind to.
 */
@Immutable
data class DataNode(val path: String, val key: String? = null) {

    /** A named part of this node: `feed.card` / `authorChip` → `feed.card.authorChip`. */
    operator fun div(part: String): DataNode = DataNode("$path.$part")

    /** This node as the instance [key] names. */
    fun keyed(key: String): DataNode = copy(key = key)

    /** The testTag the node wears. */
    val tag: String get() = if (key == null) path else "$path$KEY_SEPARATOR$key"

    companion object {
        /** Between an instance root's path and its key, in its one tag. */
        const val KEY_SEPARATOR = ":"
    }
}

/** Wears [node]'s tag, or nothing where the surface is not registered. */
fun Modifier.dataNode(node: DataNode?): Modifier = if (node == null) this else testTag(node.tag)

/**
 * Exposes every testTag under this node to UiAutomator as the node's
 * `resource-id` — where the conformance harness's android oracle reads the
 * data-node ids from a `uiautomator dump`. Set once at each registered
 * surface's root; it holds for the whole subtree (Compose's documented
 * UiAutomator interop, `SemanticsPropertyReceiver.testTagsAsResourceId`).
 */
fun Modifier.dataNodeSurface(): Modifier = semantics { testTagsAsResourceId = true }
