package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertThrows
import org.junit.Test

class IdentifiersTest {

    @Test
    fun actIdRoundTrips() {
        val id = ActId("alice-addr", 7u, Family.OPINION)
        assertThat(id.toString()).isEqualTo("act:alice-addr:7:opinion")
        assertThat(ActId.parse(id.toString())).isEqualTo(id)
    }

    @Test
    fun nodeIdsRoundTrip() {
        for (text in listOf("addr:alice", "prof:alice", "name:bot-defense", "mint:act:alice:0:publish")) {
            assertThat(NodeId.parse(text).toString()).isEqualTo(text)
        }
    }

    @Test
    fun everyFamilyNameRoundTrips() {
        for (family in Family.entries - Family.UNKNOWN) {
            assertThat(Family.parse(family.wireName)).isEqualTo(family)
        }
        assertThrows(IdentifierException::class.java) { Family.parse("nope") }
    }

    @Test
    fun theUnknownFamilyNeverEntersTheAlgebra() {
        assertThrows(IdentifierException::class.java) { Family.UNKNOWN.wireName }
        assertThrows(IdentifierException::class.java) { ActId("alice", 1u, Family.UNKNOWN) }
        assertThrows(IdentifierException::class.java) { Family.parse("UNKNOWN") }
    }

    @Test
    fun invalidAtomsAreRefused() {
        assertThrows(IdentifierException::class.java) { NodeId.Addr("has space") }
        assertThrows(IdentifierException::class.java) { NodeId.Name("colon:inside") }
        assertThrows(IdentifierException::class.java) { NodeId.Addr("") }
        assertThrows(IdentifierException::class.java) { NodeId.Addr("x".repeat(129)) }
        assertThrows(IdentifierException::class.java) { ActId("bad atom", 1u, Family.OPINION) }
    }

    @Test
    fun unparseableFormsAreRefused() {
        for (bad in listOf("", "addr", "mint:notanact", "act:a:x:opinion", "act:a:1:nope", "act:a:1")) {
            assertThrows(IdentifierException::class.java) {
                if (bad.startsWith("act")) ActId.parse(bad) else NodeId.parse(bad)
            }
        }
    }
}
