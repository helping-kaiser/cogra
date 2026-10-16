// The Dimension scalar's adapter: a zero is written as the positive one
// whichever sign it arrived with, and every other value passes through.

package com.cogra.network

import com.apollographql.apollo.api.CustomScalarAdapters
import com.apollographql.apollo.api.json.BufferedSinkJsonWriter
import com.google.common.truth.Truth.assertThat
import okio.Buffer
import org.junit.Test

class DimensionAdapterTest {

    private fun written(value: Double): String {
        val buffer = Buffer()
        BufferedSinkJsonWriter(buffer).use { DimensionAdapter.toJson(it, CustomScalarAdapters.Empty, value) }
        return buffer.readUtf8()
    }

    @Test
    fun bothZerosAreWrittenAsThePositiveZero() {
        assertThat(written(-0.0)).isEqualTo(written(0.0))
        assertThat(written(-0.0)).doesNotContain("-")
    }

    @Test
    fun everyOtherValuePassesThroughUnchanged() {
        assertThat(written(-0.3)).isEqualTo("-0.3")
        assertThat(written(0.5)).isEqualTo("0.5")
    }
}
