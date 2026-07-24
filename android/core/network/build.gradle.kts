// The transport module: the generated Apollo client and the slice-1
// operations, the encrypted token/identity stores (Tink AEAD under a
// Keystore master key), the single-flight refresh machinery, and the
// repository implementations binding core:domain's interfaces. No UI.

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.apollo)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.cogra.core.network"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        minSdk = libs.versions.minSdk.get().toInt()
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

// Apollo generates the typed client from the repo-root schema.graphql — the
// single checked-in backend contract (docs/implementation/android.md). Never
// hand-edit the generated code; regenerate it from the schema instead.
// Operations live under src/main/graphql/.
apollo {
    service("cogra") {
        packageName.set("com.cogra.network.graphql")
        schemaFiles.from(file("../../../schema.graphql"))
        // The API's custom scalars: ids stay strings (the wire form),
        // Dimension is a bounded Double, DateTime parses to Instant.
        mapScalar("UUID", "kotlin.String", "com.apollographql.apollo.api.StringAdapter")
        mapScalar("Dimension", "kotlin.Double", "com.apollographql.apollo.api.DoubleAdapter")
        mapScalar("DateTime", "java.time.Instant", "com.cogra.network.InstantAdapter")
    }
}

dependencies {
    api(project(":core:domain"))
    implementation(libs.apollo.runtime)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.tink.android)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
}
