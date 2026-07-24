// The client-side crypto of the interim act-authentication realization
// (crates/common/src/l1 is the reference; client-crypto-vectors.json is
// the cross-language contract): deterministic CBOR, tagged hashing,
// Ed25519 signing, the admission handshake, and the key-backup blob.
// Plain Kotlin — no Android dependencies — so the whole module tests on
// the JVM against the golden vectors.

plugins {
    alias(libs.plugins.kotlin.jvm)
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(libs.bouncycastle.provider)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.serialization.json)
}
