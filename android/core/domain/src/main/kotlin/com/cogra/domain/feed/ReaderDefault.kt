// THE READER'S DEFAULT (SettingsReading.md; FeedSheet.md:59-61; FeedFilter.jsx
// "THE DEFAULT IS THE READER'S"): the filter every feed opens with, set in
// Settings' What your feed shows sheet — CoGra's own ([FeedFilter.DEFAULT])
// until the reader sets theirs. web's twin is `web/src/lib/feed/reader-default.ts`.
//
// IT STAYS ON THIS DEVICE (SettingsReading.md: "ALWAYS the reader's saved
// default stays on this device"; ranked-feed packet CD-6: "The default lives
// on the device, so it is never sent"): the sealed device store, per account,
// beside Explore's recents — never a `setPreferences` field, and Settings'
// erase takes it with the rest. A default never holds a topic: the settings
// sheet draws no topic section.

package com.cogra.domain.feed

import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import javax.inject.Inject

/** Where each account's default is kept on this device. */
interface ReaderDefaultStore {
    /** [account]'s saved default, or null where they set none (or it no longer reads). */
    fun watch(account: String): Flow<FeedFilter?>

    suspend fun save(account: String, filter: FeedFilter)
}

/**
 * The signed-in reader's default, following the active account: a sign-in
 * brings that account's own, and a Settings Done repaints every surface that
 * reads it — the feed's trigger, the Settings row, search's order and seen.
 * A guest has no Settings, so a guest's is always CoGra's.
 */
class ReaderDefaults @Inject constructor(
    private val store: ReaderDefaultStore,
    private val tokens: TokenStore,
) {
    @OptIn(ExperimentalCoroutinesApi::class)
    val current: Flow<FeedFilter> = tokens.tokens
        .map { it?.accountId }
        .distinctUntilChanged()
        .flatMapLatest { account ->
            if (account == null) flowOf(FeedFilter.DEFAULT) else store.watch(account).map { it ?: FeedFilter.DEFAULT }
        }
        .distinctUntilChanged()

    /** The default as it stands now — what a new feed opens with. */
    suspend fun now(): FeedFilter = current.first()

    /** Saves [filter] as the signed-in reader's default; no one signed in keeps nothing. */
    suspend fun save(filter: FeedFilter) {
        val account = tokens.current()?.accountId ?: return
        store.save(account, filter.copy(topic = null))
    }
}
