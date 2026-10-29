// The kept picks' fakes: an in-memory store with the real one's laws (one per
// target and family, oldest first, strictly ordered) and a scripted preview
// read.

package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.KeptPick
import com.cogra.domain.stance.KeptPickStore
import com.cogra.domain.stance.KeptPreview
import com.cogra.domain.stance.KeptPreviewRepository
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update

class InMemoryKeptPickStore : KeptPickStore {
    val picks = MutableStateFlow<List<KeptPick>>(emptyList())
    private var clock = 0L

    override fun watch(): Flow<List<KeptPick>> = picks

    override suspend fun list(): List<KeptPick> = picks.value

    override suspend fun keep(target: StanceTarget, pick: StancePair, family: KeptFamily, kind: StanceKind?) {
        clock += 1
        picks.update { kept ->
            kept.filterNot { it.target == target && it.family == family } + KeptPick(target, pick, family, kind, clock)
        }
    }

    override suspend fun drop(targets: List<StanceTarget>, family: KeptFamily) {
        picks.update { kept -> kept.filterNot { it.family == family && it.target in targets } }
    }
}

/** Answers what a test scripts per target; an unscripted target's read gets no answer. */
class ScriptedKeptPreviewRepository : KeptPreviewRepository {
    val previews = mutableMapOf<StanceTarget, KeptPreview>()
    val asked = mutableListOf<StanceTarget>()

    override suspend fun preview(target: StanceTarget, kind: StanceKind?): Outcome<KeptPreview> {
        asked += target
        if (target is StanceTarget.Topic) return Outcome.Success(KeptPreview(StanceKind.TOPIC, target.name))
        return previews[target]?.let { Outcome.Success(it) } ?: Outcome.Failed(IllegalStateException("offline"))
    }
}
