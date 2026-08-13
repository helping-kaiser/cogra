package com.cogra.feature.content

/**
 * Which read fetch last completed with a fault. The fault surfaces
 * where that fetch was requested — a failed refresh on the banner
 * above the content, a failed page fetch in place of the load-more
 * control (android.md "Degrade, never crash").
 */
enum class TransportFault { REFRESH, APPEND }
