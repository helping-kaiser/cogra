package com.cogra.domain.feed

import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.store.TokenStore
import javax.inject.Inject

/**
 * Whose view the feed ranks (CD-5; §4.7): `borrowedView?.id ?? own actor`.
 * A borrowing reader — a guest on the Genesis Moderator's view, an
 * applicant on their inviter's — ranks the lender's view; the moment the
 * ladder ends, the next fetch passes the reader's own id (blessing 57's
 * hand-over). Read afresh at every fetch for exactly that reason.
 *
 * A failed ladder read is the fetch's failure, never a guess: ranking a
 * view the reader did not ask for is the unlabelled feed §9 refuses.
 */
class FeedViewer @Inject constructor(
    private val account: AccountRepository,
    private val tokens: TokenStore,
) {
    /** The viewer id; Success(null) when there is no view to rank at all. */
    suspend fun resolve(): Outcome<String?> = view().map { it?.viewer }

    /**
     * The view and, where it is borrowed, whose: the sheet and the trigger
     * speak a borrowed view's people in that account's name (FeedSheet.md,
     * "GIVEN the feed borrows a view").
     */
    suspend fun view(): Outcome<FeedView?> = account.borrowedView().map { lender ->
        lender?.let { FeedView(it.id, it.handle) } ?: tokens.current()?.accountId?.let { FeedView(it, null) }
    }
}

/** Whose view the feed ranks, and the borrowed view's account's handle where it is not the reader's own. */
data class FeedView(val viewer: String, val borrowedHandle: String?)
