package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.ReferenceContentKind
import kotlinx.coroutines.CompletableDeferred

/**
 * The sheet's by-id read, scripted: every ask is recorded, [answer] is what
 * it serves, and a [gate] holds the answer back until a test opens it.
 */
internal class ScriptedReferenceReads(
    var answer: Outcome<List<ReferenceClaimView>?> = Outcome.Success(emptyList()),
) {
    val asked = mutableListOf<Pair<ReferenceContentKind, String>>()
    var gate: CompletableDeferred<Unit>? = null

    val reads = ReferenceReads(
        referencesOf = { kind, id ->
            asked += kind to id
            gate?.await()
            answer
        },
    )
}
