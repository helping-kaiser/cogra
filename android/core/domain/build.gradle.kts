plugins {
    alias(libs.plugins.kotlin.jvm)
}

// Pure-Kotlin module: no Android dependencies, so it unit-tests as plain JVM
// (docs/implementation/android.md — "plain Kotlin, no Android dependencies").
dependencies {
    implementation(libs.kotlinx.coroutines.core)
    // @Inject on use-case constructors lets the DI graph build them; javax.inject
    // is plain Java, so the domain module stays Android-free.
    implementation(libs.javax.inject)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
}

kotlin {
    jvmToolchain(17)
}
