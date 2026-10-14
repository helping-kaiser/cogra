package com.cogra.core.designsystem

/**
 * The [RowLine]'s three states, one master:
 * - [Signing] — a hold's signature past 200ms: `Signing…`, the pending
 *   marker's quiet register, announced politely;
 * - [DidntSign] — the hold did not sign: `That didn't sign.` in the failure
 *   voice and `Retry`, which asks the same hold again;
 * - [DidntGoThrough] — a read-side comfort (save, unsave, hide, undo,
 *   unhide) reverted: `That didn't go through.` and `Retry`, which asks the
 *   comfort again and signs nothing.
 */
sealed interface RowLineState {
    data object Signing : RowLineState

    data class DidntSign(val onRetry: () -> Unit) : RowLineState

    data class DidntGoThrough(val onRetry: () -> Unit) : RowLineState
}
