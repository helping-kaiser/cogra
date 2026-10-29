// Finding the registered screens' parts by their data-node paths
// (`design/designs/canonical/nodes.json`). A part carries its bare path and
// takes its key from the instance it sits in, so a test reaches one card's
// part the way the conformance harness pairs it: by (path, instance key).

package com.cogra.feature.content

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.SemanticsNodeInteractionCollection
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag

/** A feed card's own tag: the instance root keyed by its post's id. */
internal fun feedCard(postId: String): String = "feed.card:$postId"

/** The part [path] inside the instance tagged [instance]. */
internal fun inInstance(instance: String, path: String): SemanticsMatcher =
    hasTestTag(path) and hasAnyAncestor(hasTestTag(instance))

internal fun SemanticsNodeInteractionsProvider.onNodeIn(
    instance: String,
    path: String,
    useUnmergedTree: Boolean = false,
): SemanticsNodeInteraction = onNode(inInstance(instance, path), useUnmergedTree)

internal fun SemanticsNodeInteractionsProvider.onAllNodesIn(
    instance: String,
    path: String,
    useUnmergedTree: Boolean = false,
): SemanticsNodeInteractionCollection = onAllNodes(inInstance(instance, path), useUnmergedTree)

/** The detail's one card, whichever post it carries. */
internal fun isDetailCard(): SemanticsMatcher = SemanticsMatcher("is the detail's card") { node ->
    node.config.getOrNull(SemanticsProperties.TestTag)?.startsWith("postDetail.card:") == true
}

/**
 * The node at [path], keyed or not: a part the board draws once per state
 * (`postEdit.sign:none`, `postEdit.sign:slow`) is found whichever state it
 * stands in.
 */
internal fun isNode(path: String): SemanticsMatcher = SemanticsMatcher("is the node $path") { node ->
    val tag = node.config.getOrNull(SemanticsProperties.TestTag)
    tag == path || tag?.startsWith("$path:") == true
}

/** A thread comment card's own tag: `postDetail.threadSheet.commentCard` keyed by the comment's id. */
internal fun threadCard(commentId: String): String = "postDetail.threadSheet.commentCard:$commentId"

/** A part of a thread comment card (`menu`, `actionRow.reply`), found with [onNodeIn] inside [threadCard]. */
internal fun threadPart(part: String): String = "postDetail.threadSheet.commentCard.$part"
