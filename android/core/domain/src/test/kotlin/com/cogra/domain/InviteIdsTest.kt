package com.cogra.domain

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class InviteIdsTest {

    private val id = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1"

    @Test
    fun extractsFromUrlsAndBareIds() {
        assertThat(extractInviteId("https://cogra.example/join/$id")).isEqualTo(id)
        assertThat(extractInviteId("  $id  ")).isEqualTo(id)
        assertThat(extractInviteId("no id here")).isNull()
    }

    @Test
    fun uppercaseInputLowercases() {
        assertThat(extractInviteId(id.uppercase())).isEqualTo(id)
    }

    @Test
    fun theLastUuidWins() {
        val earlier = "9f1c2d33-0a1b-4c5d-8e6f-a7b8c9d0e1f2"
        val input = "my old link $earlier — use https://cogra.example/join/$id"
        assertThat(extractInviteId(input)).isEqualTo(id)
    }
}
