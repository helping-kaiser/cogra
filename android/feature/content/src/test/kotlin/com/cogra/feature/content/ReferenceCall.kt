package com.cogra.feature.content

/**
 * One staged Reference act, as a fake `ReferenceRepository` saw it.
 * Shared by the composer's and the detail view's ViewModel tests — both
 * assert that a change stages exactly the acts it should, at the
 * parameters it should.
 */
internal data class ReferenceCall(
    val artifact: String,
    val target: String,
    val relevance: Double?,
    val support: Double?,
)
