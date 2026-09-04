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

// `client-crypto-vectors.json` is read from the repo root at test time
// rather than compiled in, so it belongs to no source set and Gradle
// cannot see it. Undeclared, the up-to-date check and the build cache
// both hand back a pass computed against the previous `make vectors`
// output — a regenerated contract would report green without running.
// Declaring the runtime-read file as a task input is Gradle's own
// answer (user manual, "Incremental build": a task's inputs are what
// its result depends on). `workingDir` is stated for the same reason:
// the test names the file by a path relative to this module.
tasks.withType<Test>().configureEach {
    workingDir = projectDir
    inputs.file(file("../../../client-crypto-vectors.json"))
        .withPropertyName("clientCryptoVectors")
        .withPathSensitivity(PathSensitivity.NONE)
}

dependencies {
    implementation(libs.bouncycastle.provider)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.serialization.json)
}
