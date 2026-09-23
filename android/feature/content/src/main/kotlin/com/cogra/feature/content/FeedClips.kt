package com.cogra.feature.content

import androidx.compose.foundation.lazy.LazyListItemInfo
import androidx.compose.foundation.lazy.LazyListLayoutInfo
import com.cogra.domain.PostView

/**
 * The feed's clips, in the order the reader meets them, and which of them
 * the reader is at — what the stage reads ahead of the reader
 * (`PreloadClips`, `VideoPreload`).
 *
 * A post contributes the clip its card leads with: the one the card's
 * gallery plays when it reaches the autoplay bar. A removed body draws no
 * gallery and contributes nothing. A clip that appears twice is listed
 * where the reader first meets it.
 */
internal class FeedClips private constructor(
    /** The clips' URLs, by rank. */
    val urls: List<String>,
    /** The feed position of the post each clip belongs to, by rank. */
    private val clipPosts: List<Int>,
    /** Every post's feed position, by its list key. */
    private val postIndex: Map<String, Int>,
) {

    /** Which clip the reader is at, read off the list's current layout. */
    fun focus(layout: LazyListLayoutInfo): Int {
        val middle = (layout.viewportStartOffset + layout.viewportEndOffset) / 2
        val post = focusedPost(layout.visibleItemsInfo, middle) { key -> (key as? String)?.let(postIndex::get) }
        return focusedClip(clipPosts, post)
    }

    companion object {
        fun of(posts: List<PostView>): FeedClips {
            val urls = mutableListOf<String>()
            val clipPosts = mutableListOf<Int>()
            val seen = HashSet<String>()
            posts.forEachIndexed { index, post ->
                val clip = post.leadClip()
                if (clip != null && seen.add(clip)) {
                    urls += clip
                    clipPosts += index
                }
            }
            return FeedClips(urls, clipPosts, posts.withIndex().associate { it.value.id to it.index })
        }
    }
}

/** The clip a post's card leads with, or null when its body plays none. */
internal fun PostView.leadClip(): String? =
    attachments.firstOrNull()
        ?.takeIf { it.isVideo && !isRemoved(content, attachments, attachmentsStatus) }
        ?.url

/**
 * The feed position of the post at the middle of the list: the first
 * visible post whose bottom edge lies below the middle — the one being
 * read, or the next one down when the middle falls in a gap. Past the
 * last visible post it is the position after it; with no post visible at
 * all, the top of the feed.
 */
internal fun focusedPost(visible: List<LazyListItemInfo>, middle: Int, postIndex: (Any) -> Int?): Int {
    val posts = visible.mapNotNull { item -> postIndex(item.key)?.let { it to item } }
    return posts.firstOrNull { (_, item) -> item.offset + item.size > middle }?.first
        ?: posts.lastOrNull()?.first?.plus(1)
        ?: 0
}

/**
 * The rank of the first clip at or below [focusedPost] — the clip the
 * reader is reading, or the next one they will reach. Past the last clip,
 * one beyond it: every clip is then behind the reader.
 */
internal fun focusedClip(clipPosts: List<Int>, focusedPost: Int): Int =
    clipPosts.indexOfFirst { it >= focusedPost }.let { if (it < 0) clipPosts.size else it }
