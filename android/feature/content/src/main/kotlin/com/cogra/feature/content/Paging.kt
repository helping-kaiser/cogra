package com.cogra.feature.content

/**
 * Append a fetched page to a held list, dropping entries already shown.
 *
 * A listing page is a snapshot, not a live view. Pending entries sort
 * above every landed one in their own cursor namespace, and an entry's
 * cursor changes when it lands — so a walk that spans a landing can
 * serve the same node in two pages. The client's contract is to neither
 * merge newly pending items into a page it already holds nor reconcile
 * a held page against a newer one: it appends what is new and keeps the
 * copy it already showed. A refetch is what carries a new page; a
 * node's own landing state reaches the entry already on screen through
 * `LandingSignal` (api-spec.md "Pending entries come first, in their
 * own cursor namespace" and "A page is a snapshot, not a live view").
 */
internal fun <T> List<T>.appendPage(page: List<T>, id: (T) -> String): List<T> {
    val held = mapTo(mutableSetOf(), id)
    return this + page.filterNot { id(it) in held }
}
