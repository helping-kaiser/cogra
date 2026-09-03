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
    id("cogra.android.module")
}

android {
    namespace = "com.cogra.core.network"
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
        mapScalar("RecordId", "kotlin.String", "com.apollographql.apollo.api.StringAdapter")
        mapScalar("Dimension", "kotlin.Double", "com.apollographql.apollo.api.DoubleAdapter")
        mapScalar("DateTime", "java.time.Instant", "com.cogra.network.InstantAdapter")
        // `uploadMedia` is the one operation carrying binary, and the
        // binary rides the GraphQL multipart request (api-spec.md).
        // `mapScalarToUpload` is Apollo's own hook for that scalar —
        // it wires the multipart body and the `map`/`variables` parts
        // without a hand-written adapter
        // (apollographql.com/docs/kotlin/advanced/upload).
        mapScalarToUpload("Upload")
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
    testImplementation(testFixtures(project(":core:domain")))
}
