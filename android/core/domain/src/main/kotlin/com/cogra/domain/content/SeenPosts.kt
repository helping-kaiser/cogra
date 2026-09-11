package com.cogra.domain.content

import com.cogra.domain.PostView
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The posts this device has already read, so a surface opening one it
 * came from can paint it at once instead of an empty screen.
 *
 * Opening a post from the feed used to show a spinner over nothing for
 * the length of a round trip, which the forward transition then slid
 * into view — so the slide had nothing to carry and did not read as one
 * (HT-10). The reader had the post on screen a moment earlier; holding
 * it is what lets the detail start from there and let its own read
 * catch up behind.
 *
 * **This is not a page cache and it never becomes one.** Nothing here
 * inserts, removes or reorders a listing, and no held page is
 * reconciled against it (api-spec.md "A page is a snapshot, not a live
 * view"). What it holds is one node, keyed by its own id, and every
 * surface that reads it immediately asks the server anyway — the held
 * copy is the first frame, never the answer. Its comments are not here
 * at all: the detail's thread is always the fresh read's.
 *
 * Bounded and oldest-out, because a long walk down the feed would
 * otherwise hold every post the reader scrolled past for the life of
 * the process.
 */
@Singleton
class SeenPosts @Inject constructor() {

    private val held = object : LinkedHashMap<String, PostView>(CAPACITY, LOAD_FACTOR, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, PostView>): Boolean =
            size > CAPACITY
    }

    @Synchronized
    fun saw(posts: List<PostView>) {
        posts.forEach { held[it.id] = it }
    }

    @Synchronized
    fun saw(post: PostView) {
        held[post.id] = post
    }

    /** The last read of this post, or null if the device has none. */
    @Synchronized
    fun lastSeen(id: String): PostView? = held[id]

    private companion object {
        /** Several feed pages' worth — well past what one walk shows. */
        const val CAPACITY = 120

        /** `LinkedHashMap`'s own default; named because the ctor needs it. */
        const val LOAD_FACTOR = 0.75f
    }
}
