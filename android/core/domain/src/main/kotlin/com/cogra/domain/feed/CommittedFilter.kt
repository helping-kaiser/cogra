// THE FILTER A FEED'S DONE COMMITTED (FeedSheet.md, design round 25: "ALWAYS
// a filter committed with Done lasts on this device until the reader changes
// it, through a reload, a restart and a cold launch alike, and the feed opens
// with it"; "ALWAYS a filter committed with Done never travels to another
// device and never changes the reader's saved default in Settings";
// SettingsReading.md: "ALWAYS a feed opens with the reader's saved default
// GIVEN no filter committed inside that feed stands on this device").
//
// So it is the device's, per account, in the same sealed store the reader's
// default and Explore's recents ride — a slot of its own beside the default,
// never the default itself. A guest's sits under the guest's own name and is
// never carried into an account. Unlike a default, it holds the topic: a feed
// narrowed to one stays narrowed.

package com.cogra.domain.feed

import com.cogra.domain.store.TokenStore
import javax.inject.Inject

/** Where each account's committed feed filter is kept on this device; a null account is the guest's. */
interface CommittedFilterStore {
    /** [account]'s committed filter, or null where none stands (or it no longer reads). */
    suspend fun committed(account: String?): FeedFilter?

    suspend fun commit(account: String?, filter: FeedFilter)

    /** No filter stands any more: the feed opens with the reader's saved default again. */
    suspend fun forget(account: String?)
}

/** The active reader's committed feed filter. */
class CommittedFeedFilter @Inject constructor(
    private val store: CommittedFilterStore,
    private val tokens: TokenStore,
) {
    /** The filter a Done committed on this device for the active reader, or null where none stands. */
    suspend fun now(): FeedFilter? = store.committed(tokens.current()?.accountId)

    /** A Done's filter, kept on this device until the reader changes it. */
    suspend fun commit(filter: FeedFilter) = store.commit(tokens.current()?.accountId, filter)

    /** The feed returns to the reader's default (FeedNothing's way back): nothing committed stands. */
    suspend fun forget() = store.forget(tokens.current()?.accountId)
}
