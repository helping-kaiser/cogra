// Pins every hand-maintained domain enum to the generated one it is
// joined to by string in Mapping.kt.
//
// The join is `valueOf(rawValue)` with `getOrDefault(UNKNOWN)`, and
// UNKNOWN already means "a value this build does not know" — so without
// this test a code renamed or removed in `schema.graphql` degrades
// silently and reads exactly like an old app talking to a new server.
// The contract change would reach a device as a shrug.
//
// `Family` answers to a third master on top of that: its wire names are
// the L1 census (pinned by core:crypto's golden vectors) and its
// CONSTANT NAMES are the GraphQL enum, because that is what
// `Family.valueOf(rawValue)` reads. Nothing else declares that coupling.

package com.cogra.network

import com.cogra.crypto.Family
import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.AccountState
import com.cogra.domain.ErrorCode
import com.cogra.domain.MediaAssetState
import com.cogra.domain.WriteState
import com.cogra.domain.feed.PeopleMark
import com.cogra.network.graphql.type.MediaAttachmentState
import com.cogra.network.graphql.type.RecordFamily
import com.cogra.network.graphql.type.StagedWriteState
import com.google.common.truth.Truth.assertWithMessage
import org.junit.Test

private typealias GeneratedAccountState = com.cogra.network.graphql.type.AccountState
private typealias GeneratedAccountDeletionPath = com.cogra.network.graphql.type.AccountDeletionPath
private typealias GeneratedErrorCode = com.cogra.network.graphql.type.ErrorCode
private typealias GeneratedPeopleMark = com.cogra.network.graphql.type.PeopleMark

class EnumParityTest {

    private fun assertParity(label: String, generated: List<String>, domain: List<String>) {
        assertWithMessage("%s: the domain enum's members are the schema's", label)
            .that(domain)
            .containsExactlyElementsIn(generated)
    }

    @Test
    fun `every domain enum carries exactly the members the schema declares`() {
        assertParity(
            "ErrorCode",
            GeneratedErrorCode.knownValues().map { it.rawValue },
            ErrorCode.entries.filter { it != ErrorCode.UNKNOWN }.map { it.name },
        )
        assertParity(
            "WriteState",
            StagedWriteState.knownValues().map { it.rawValue },
            WriteState.entries.filter { it != WriteState.UNKNOWN }.map { it.name },
        )
        assertParity(
            "AccountState",
            GeneratedAccountState.knownValues().map { it.rawValue },
            AccountState.entries.filter { it != AccountState.UNKNOWN }.map { it.name },
        )
        assertParity(
            "AccountDeletionPath",
            GeneratedAccountDeletionPath.knownValues().map { it.rawValue },
            AccountDeletionPath.entries.filter { it != AccountDeletionPath.UNKNOWN }.map { it.name },
        )
        assertParity(
            "Family",
            RecordFamily.knownValues().map { it.rawValue },
            Family.entries.filter { it != Family.UNKNOWN }.map { it.name },
        )
        // Joined by `when` in FeedRepositoryImpl, where an unknown mark reads
        // as none: a mark the schema grows would silently admit nowhere.
        assertParity(
            "PeopleMark",
            GeneratedPeopleMark.knownValues().map { it.rawValue },
            PeopleMark.entries.map { it.name },
        )
        assertParity(
            "MediaAssetState",
            MediaAttachmentState.knownValues().map { it.rawValue },
            MediaAssetState.entries.filter { it != MediaAssetState.UNKNOWN }.map { it.name },
        )
    }
}
