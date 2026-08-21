package com.cogra.domain.content

import com.cogra.domain.Landing
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/** One node's landing state as a read just saw it. */
data class NodeLanding(val nodeId: String, val landing: Landing)

/**
 * Where a node stands relative to L1 finality, as the freshest read on
 * this device saw it — so a surface that already carries that node can
 * show what the device knows instead of what its own page said.
 *
 * A listing page stays a snapshot: nothing here inserts, removes, or
 * reorders an entry, and no held page is reconciled against a newer one
 * (api-spec.md "A page is a snapshot, not a live view"). What travels
 * is one node's own state, from a read of that node.
 *
 * It is an event stream rather than a cache because freshness is the
 * whole point and a node's state is not monotone — an unlanded edit
 * leaves a landed node PENDING again (api-spec.md `Landing`). A held
 * entry takes the observations that arrive after its page did; a later
 * page arrives fresher on its own.
 */
@Singleton
class LandingSignal @Inject constructor() {

    // Dropping the oldest keeps the emit non-suspending: an observation
    // no reader kept up with is stale by definition.
    private val _updates = MutableSharedFlow<NodeLanding>(
        extraBufferCapacity = 16,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    val updates: SharedFlow<NodeLanding> = _updates.asSharedFlow()

    fun observed(nodeId: String, landing: Landing) {
        _updates.tryEmit(NodeLanding(nodeId, landing))
    }
}
