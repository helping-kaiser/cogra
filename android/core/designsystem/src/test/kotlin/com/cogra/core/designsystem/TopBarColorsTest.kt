package com.cogra.core.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TopAppBarColors
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TopBarColorsTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theBarNeverTintsOnScroll() {
        var colors: TopAppBarColors? = null
        var surface = Color.Unspecified
        compose.setContent {
            colors = surfaceTopAppBarColors()
            surface = MaterialTheme.colorScheme.surface
        }
        assertThat(colors?.scrolledContainerColor).isEqualTo(surface)
        assertThat(colors?.containerColor).isEqualTo(surface)
    }
}
