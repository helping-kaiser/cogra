package com.cogra.domain.stance

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A stance was just signed, somewhere in the app — the one fact the
 * borrowed-view band has to hear about (VouchBack.md:21): the member's
 * first opinion ends the borrowing toward ANY target and from ANY surface,
 * so the band cannot learn it from its own screen. Every stance holder
 * announces each signing it had taken; the band re-reads `borrowedView`.
 * The web's twin is `signed-events.ts`.
 *
 * It carries no payload on purpose. Whether the signing ended the
 * borrowing is the contract's call — an Affinity never does (:25), an
 * Opinion on anyone does — and the band asks the contract rather than
 * re-deriving the rule from what was signed.
 */
@Singleton
class StanceSignals @Inject constructor() {

    // Dropping the oldest keeps the emit non-suspending: a re-read asked
    // twice is the same re-read.
    private val _signed = MutableSharedFlow<Unit>(
        extraBufferCapacity = 8,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    val signed: SharedFlow<Unit> = _signed.asSharedFlow()

    fun announceSigned() {
        _signed.tryEmit(Unit)
    }
}
