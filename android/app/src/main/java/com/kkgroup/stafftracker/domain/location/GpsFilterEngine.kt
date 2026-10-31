package com.kkgroup.stafftracker.domain.location

import com.kkgroup.stafftracker.domain.model.FilterReason
import com.kkgroup.stafftracker.domain.model.FilterResult
import com.kkgroup.stafftracker.domain.model.GpsPoint
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Production-grade GPS noise and jitter filtering engine.
 * Implements Haversine distance, speed-threshold sanity checks, and stationary jitter suppression.
 */
class GpsFilterEngine(
    private val maxAccuracyMeters: Float = 40.0f,
    private val minDisplacementMeters: Double = 10.0,
    private val maxRealisticSpeedKmh: Double = 130.0
) {

    /**
     * Evaluates a incoming GPS fix against the previous valid point.
     * @param current The latest GPS reading
     * @param previous The previous valid GPS reading (if any)
     */
    fun evaluatePoint(current: GpsPoint, previous: GpsPoint?): FilterResult {
        // Rule 1: Accuracy Gate
        if (current.accuracy > maxAccuracyMeters) {
            return FilterResult.Filtered(FilterReason.ACCURACY_EXCEEDED)
        }

        // Rule 2: Reported instantaneous speed check (speed is in m/s)
        val reportedSpeedKmh = current.speed * 3.6
        if (reportedSpeedKmh > maxRealisticSpeedKmh) {
            return FilterResult.Filtered(FilterReason.EXCESSIVE_SPEED)
        }

        // First point in session is accepted without distance increment
        if (previous == null) {
            return FilterResult.Valid(distanceIncrementKm = 0.0, speedKmh = reportedSpeedKmh)
        }

        val timeDeltaSeconds = (current.timestamp - previous.timestamp) / 1000.0
        if (timeDeltaSeconds <= 0.0) {
            return FilterResult.Filtered(FilterReason.STATIONARY_JITTER)
        }

        val distanceKm = calculateHaversineDistanceKm(
            lat1 = previous.latitude,
            lon1 = previous.longitude,
            lat2 = current.latitude,
            lon2 = current.longitude
        )
        val distanceMeters = distanceKm * 1000.0

        // Rule 3: Stationary Jitter Suppression (ignore tiny GPS drift while stationary)
        if (distanceMeters < minDisplacementMeters) {
            return FilterResult.Filtered(FilterReason.STATIONARY_JITTER)
        }

        // Rule 4: Implied Velocity Teleport Check
        val calculatedSpeedKmh = (distanceMeters / timeDeltaSeconds) * 3.6
        if (calculatedSpeedKmh > maxRealisticSpeedKmh) {
            return FilterResult.Filtered(FilterReason.IMPLAUSIBLE_JUMP)
        }

        val finalSpeedKmh = if (reportedSpeedKmh > 0) reportedSpeedKmh else calculatedSpeedKmh
        return FilterResult.Valid(distanceIncrementKm = distanceKm, speedKmh = finalSpeedKmh)
    }

    /**
     * Calculates the great-circle distance between two points on the Earth's surface
     * using the Haversine formula (Mean Earth Radius = 6371.0088 km).
     */
    fun calculateHaversineDistanceKm(
        lat1: Double,
        lon1: Double,
        lat2: Double,
        lon2: Double
    ): Double {
        val earthRadiusKm = 6371.0088

        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val originLat = Math.toRadians(lat1)
        val targetLat = Math.toRadians(lat2)

        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(originLat) * cos(targetLat) *
                sin(dLon / 2) * sin(dLon / 2)

        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadiusKm * c
    }
}
