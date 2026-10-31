package com.kkgroup.stafftracker.domain.model

data class GpsPoint(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double = 0.0,
    val accuracy: Float,
    val speed: Float = 0.0f,
    val bearing: Float = 0.0f,
    val timestamp: Long = System.currentTimeMillis()
)

sealed class FilterResult {
    data class Valid(val distanceIncrementKm: Double, val speedKmh: Double) : FilterResult()
    data class Filtered(val reason: FilterReason) : FilterResult()
}

enum class FilterReason {
    ACCURACY_EXCEEDED,
    EXCESSIVE_SPEED,
    STATIONARY_JITTER,
    IMPLAUSIBLE_JUMP
}
