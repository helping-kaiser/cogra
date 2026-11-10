package com.cogra.app.di

import com.cogra.domain.CograLog
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Test
import java.io.IOException
import java.util.concurrent.CopyOnWriteArrayList

class AppModuleTest {

    private class Line(val tag: String, val cause: Throwable?)

    private val lines = CopyOnWriteArrayList<Line>()

    @After
    fun tearDown() {
        CograLog.uninstall()
    }

    @Test
    fun `a job that fails on the application scope is logged and the scope lives on`() = runBlocking {
        CograLog.install { tag, _, cause -> lines += Line(tag, cause) }
        val scope = AppModule.applicationScope()
        val fault = IOException("disk full")

        scope.launch { throw fault }.join()
        var sibling = false
        scope.launch { sibling = true }.join()

        assertThat(lines.map { it.cause }).containsExactly(fault)
        assertThat(lines.single().tag).isEqualTo("ApplicationScope")
        assertThat(sibling).isTrue()
        scope.cancel()
    }
}
