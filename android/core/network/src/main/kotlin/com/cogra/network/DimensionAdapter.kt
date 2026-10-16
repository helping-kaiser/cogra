// The Dimension scalar — a stance or claim value in [-1, +1] — as a
// Double, referenced by name from the apollo {} block's mapScalar.
//
// A zero leaves the device as the positive one. `-0.0` is a real Double
// (a pad drag that never moved on the inverted vertical axis produces
// it) and Kotlin writes it as "-0.0", so without this an authored record
// could carry a sign of zero web's JSON never can. Every input that
// carries a Dimension serialises through here, so the rule holds for
// every authoring path at once. Reads are passed through untouched.

package com.cogra.network

import com.apollographql.apollo.api.Adapter
import com.apollographql.apollo.api.CustomScalarAdapters
import com.apollographql.apollo.api.json.JsonReader
import com.apollographql.apollo.api.json.JsonWriter

object DimensionAdapter : Adapter<Double> {
    override fun fromJson(reader: JsonReader, customScalarAdapters: CustomScalarAdapters): Double =
        reader.nextDouble()

    override fun toJson(writer: JsonWriter, customScalarAdapters: CustomScalarAdapters, value: Double) {
        // `0.0 == -0.0` is true, so this maps both zeros to the positive one.
        writer.value(if (value == 0.0) 0.0 else value)
    }
}
