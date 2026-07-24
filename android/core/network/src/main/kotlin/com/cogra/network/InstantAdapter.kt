// The DateTime scalar (RFC 3339) as java.time.Instant — referenced by
// name from the apollo {} block's mapScalar.

package com.cogra.network

import com.apollographql.apollo.api.Adapter
import com.apollographql.apollo.api.CustomScalarAdapters
import com.apollographql.apollo.api.json.JsonReader
import com.apollographql.apollo.api.json.JsonWriter
import java.time.Instant
import java.time.OffsetDateTime

object InstantAdapter : Adapter<Instant> {
    override fun fromJson(reader: JsonReader, customScalarAdapters: CustomScalarAdapters): Instant =
        OffsetDateTime.parse(reader.nextString()!!).toInstant()

    override fun toJson(writer: JsonWriter, customScalarAdapters: CustomScalarAdapters, value: Instant) {
        writer.value(value.toString())
    }
}
