// The page read's document against what prices it. `client_operations.rs`
// prices every client's `nodes(ids:)` read by operation NAME through one
// `ID_BATCHES` row, so the app's `PageStances` has to be the very read that
// row was measured with — the web's — and its chunk the server's cap the row
// sends. The schema itself is checked by Apollo's codegen at compile time.

package com.cogra.network

import com.cogra.network.repo.PAGE_STANCES_CHUNK
import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Test
import java.io.File

class PageStancesContractTest {

    /** The repo root, from this module's directory (android/core/network). */
    private val root = File("../../..")

    /** One top-level definition's text, comments dropped and whitespace collapsed. */
    private fun definition(path: String, header: String): String {
        val lines = File(root, path).readLines()
        val start = lines.indexOfFirst { it.startsWith(header) }
        check(start >= 0) { "$header is not in $path" }
        var depth = 0
        val body = StringBuilder()
        for (line in lines.drop(start)) {
            val code = line.substringBefore('#')
            body.append(code).append(' ')
            depth += code.count { it == '{' } - code.count { it == '}' }
            if (depth == 0 && code.contains('}')) break
        }
        return body.toString().replace(Regex("\\s+"), " ").trim()
    }

    @Test
    fun theAppsPageReadIsTheWebsOperationTheBudgetRowPrices() {
        val app = definition("android/core/network/src/main/graphql/stance.graphql", "query PageStances(")
        val web = definition("web/src/lib/graphql/stance.graphql", "query PageStances(")

        assertThat(app).isEqualTo(web)
        assertThat(File(root, "crates/api/tests/client_operations.rs").readText())
            .contains("(\"PageStances\", IdBatch::ServerCap)")
    }

    @Test
    fun theFragmentBothPricesWalkIsTheSame() {
        val header = "fragment StanceBundleFields on StanceBundle"
        assertThat(definition("android/core/network/src/main/graphql/stance.graphql", header))
            .isEqualTo(definition("web/src/lib/graphql/fragments.graphql", header))
    }

    @Test
    fun aPageIsChunkedAtTheServersCap() {
        val constants = Json.parseToJsonElement(File(root, "client-constants.json").readText()).jsonObject
        val cap = constants.getValue("paging").jsonObject.getValue("maxPageSize").jsonPrimitive.int
        assertThat(PAGE_STANCES_CHUNK).isEqualTo(cap)
    }
}
