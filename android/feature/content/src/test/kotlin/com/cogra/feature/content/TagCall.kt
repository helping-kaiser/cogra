package com.cogra.feature.content

/**
 * One staged Tag act, as a fake `TopicRepository` saw it. Shared by the
 * composer's and the detail view's ViewModel tests — both assert that a
 * change stages exactly the acts it should, at the parameters it should.
 */
internal data class TagCall(
    val target: String,
    val name: String,
    val pDirected: Double?,
    val pInterest: Double?,
)
