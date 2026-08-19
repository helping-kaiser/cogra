// Pins the two network security configs to each other. The debug variant
// swaps main's config for src/devCa's whenever the dev machine's mkcert root
// CA is staged, so the pair has to stay a deliberate diff: the same cleartext
// exemptions, plus a debug-only trust anchor. Editing one and forgetting the
// other either widens cleartext behind a variant or drops the guest APK's
// trust — both fail here.

package com.cogra.app

import com.google.common.truth.Truth.assertThat
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Test
import org.w3c.dom.Element

private fun parse(path: String): Element =
    DocumentBuilderFactory.newInstance()
        .newDocumentBuilder()
        .parse(File(path))
        .documentElement

private fun Element.children(tag: String): List<Element> =
    (0 until childNodes.length)
        .mapNotNull { childNodes.item(it) as? Element }
        .filter { it.tagName == tag }

private fun Element.descendants(tag: String): List<Element> {
    val matches = getElementsByTagName(tag)
    return (0 until matches.length).mapNotNull { matches.item(it) as? Element }
}

/** Every host the config lets an app reach over plain http. */
private fun Element.cleartextDomains(): Set<String> =
    children("domain-config")
        .filter { it.getAttribute("cleartextTrafficPermitted") == "true" }
        .flatMap { it.descendants("domain") }
        .map { it.textContent.trim() }
        .toSet()

class NetworkSecurityConfigTest {
    private val main = parse("src/main/res/xml/network_security_config.xml")
    private val devCa = parse("src/devCa/res/xml/network_security_config.xml")

    @Test
    fun `dev-CA config permits cleartext to exactly the hosts main permits`() {
        assertThat(devCa.cleartextDomains()).isEqualTo(main.cleartextDomains())
    }

    @Test
    fun `cleartext is confined to the loopback hosts of a dev machine`() {
        assertThat(main.cleartextDomains()).containsExactly("10.0.2.2", "localhost")
    }

    @Test
    fun `neither config permits cleartext by default`() {
        for (config in listOf(main, devCa)) {
            for (base in config.children("base-config")) {
                assertThat(base.getAttribute("cleartextTrafficPermitted")).isNotEqualTo("true")
            }
        }
    }

    @Test
    fun `the dev-CA config trusts the staged root CA as a debug-only anchor`() {
        val anchors = devCa.children("debug-overrides").flatMap { it.descendants("certificates") }

        assertThat(anchors.map { it.getAttribute("src") }).containsExactly("@raw/cogra_dev_ca")
    }

    @Test
    fun `main's config carries no debug overrides and no extra trust anchors`() {
        assertThat(main.children("debug-overrides")).isEmpty()
        assertThat(main.descendants("trust-anchors")).isEmpty()
    }

    @Test
    fun `the dev-CA config adds trust only under debug-overrides`() {
        val debugAnchors =
            devCa.children("debug-overrides").flatMap { it.descendants("trust-anchors") }

        assertThat(devCa.descendants("trust-anchors")).isEqualTo(debugAnchors)
    }
}
