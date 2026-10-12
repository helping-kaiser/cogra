package com.cogra.feature.content

import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.PostView

/**
 * THE DETAIL HOLDS WHAT WAS OPENED (jakob 2026-10-09, seam 120; drawn
 * 2026-10-12, PostDetail.md:5-15). The post a reader opened is the post
 * they read: a fresh read that finds it changed never lands under them
 * mid-sentence. It waits behind one line — `Edited since you opened it —
 * tap for the newest version.` — and the reader's tap swaps it in.
 *
 * How one answer lands — the web's `detail-freeze.ts`, case for case:
 */
internal enum class DetailLanding {
    /** Nothing painted (a post this device never read): the answer paints. */
    PAINT,

    /**
     * The reader asked — the pull, the landed-only switch, the return from
     * their own signed write. That is the reader asking for the newest
     * (PostDetail.md:5), so it lands, line or no.
     */
    ASKED,

    /**
     * The answer shows a part removed that the painted post still shows: it
     * lands at once, whatever else it changed (PostDetail.md:15; seam 120.2).
     */
    REDACTION,

    /** Another version — an edit, or a changed tag or citation set: it waits. */
    HOLD,

    /** The same version read again: taken silently, live counts and all. */
    SAME,
}

internal fun landingOf(painted: PostView?, fresh: PostView, asked: Boolean): DetailLanding = when {
    painted == null -> DetailLanding.PAINT
    asked -> DetailLanding.ASKED
    newlyRedacted(painted, fresh) -> DetailLanding.REDACTION
    isNewerVersion(painted, fresh) -> DetailLanding.HOLD
    else -> DetailLanding.SAME
}

/**
 * Whether the fresh read is a version the painted one is not: a new edit
 * (`updatedAt`, the current version row's own stamp), or a changed tag set
 * or citation set. Tags and citations are acts of their own on L1 rather
 * than edits of the post, "but the inspection must say so" (jakob, FC-G1(b))
 * — so they count the same way, by which claims stand, not by how they weigh.
 */
internal fun isNewerVersion(painted: PostView, fresh: PostView): Boolean =
    painted.updatedAt != fresh.updatedAt ||
        painted.topics.map { it.hashtag.id }.toSet() != fresh.topics.map { it.hashtag.id }.toSet() ||
        painted.references.map { it.targetId }.toSet() != fresh.references.map { it.targetId }.toSet()

/**
 * Whether the fresh read shows a part of the post removed that the painted
 * one still shows — "the post or any of its parts" (PostDetail.md:15): a
 * field, the gallery, one attachment or its cover, a tag's name. A removal
 * already on screen is not news, and the line can still hold the rest.
 *
 * The thread is not a part: the detail's post carries only its count, and
 * the comments sheet shows its own removals.
 */
internal fun newlyRedacted(painted: PostView, fresh: PostView): Boolean {
    val shown = redactedParts(painted)
    return redactedParts(fresh).any { it !in shown }
}

private fun redactedParts(post: PostView): Set<String> = buildSet {
    if (post.title.status.removed()) add("title")
    if (post.description.status.removed()) add("description")
    if (post.content.status.removed()) add("content")
    if (post.attachmentsStatus.removed()) add("attachments")
    // By the attachment's own id, so a reordered gallery is not a removal.
    post.attachments.forEach { asset -> addAsset("attachment/${asset.id}", asset) }
    post.topics.forEach { topic ->
        if (topic.hashtag.name.status.removed()) add("tag/${topic.hashtag.id}")
    }
}

private fun MutableSet<String>.addAsset(key: String, asset: MediaAssetView) {
    if (asset.status.removed()) add(key)
    asset.cover?.let { cover -> if (cover.status.removed()) add("$key/cover") }
}

private fun FieldStatus.removed(): Boolean = this == FieldStatus.REDACTED
