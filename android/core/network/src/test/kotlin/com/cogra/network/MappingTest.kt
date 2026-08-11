// The enum fallbacks: a server value this build does not know maps to
// the explicit UNKNOWN variant — degrade, never a crash (the server's
// vocabulary can grow before the app updates).

package com.cogra.network

import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.WriteState
import com.cogra.network.graphql.type.RecordFamily
import com.cogra.network.graphql.type.StagedWriteState
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class MappingTest {

    @Test
    fun unknownEnumValuesDegradeToUnknown() {
        assertThat(StagedWriteState.UNKNOWN__.toDomain()).isEqualTo(WriteState.UNKNOWN)
        assertThat(RecordFamily.UNKNOWN__.toDomain()).isEqualTo(Family.UNKNOWN)
        assertThat(com.cogra.network.graphql.type.AccountState.UNKNOWN__.toDomain())
            .isEqualTo(AccountState.UNKNOWN)
    }

    @Test
    fun knownEnumValuesMapByName() {
        assertThat(StagedWriteState.RELAYING.toDomain()).isEqualTo(WriteState.RELAYING)
        assertThat(RecordFamily.REGISTRATION.toDomain()).isEqualTo(Family.REGISTRATION)
    }
}
