package com.kkgroup.stafftracker.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "travel_sessions",
    indices = [
        Index(value = ["employeeId"]),
        Index(value = ["sessionStatus"]),
        Index(value = ["isSynced"])
    ]
)
data class TravelSessionEntity(
    @PrimaryKey
    val id: String, // Server Mongo ID or Local UUID
    val attendanceId: String,
    val employeeId: String,
    val clusterId: String? = null,
    val sessionStatus: String, // IN_PROGRESS, PAUSED, COMPLETED, CANCELLED
    val startTime: Long,
    val endTime: Long?,
    val startLatitude: Double,
    val startLongitude: Double,
    val endLatitude: Double?,
    val endLongitude: Double?,
    val totalDistanceKm: Double = 0.0,
    val totalDurationMinutes: Int = 0,
    val totalPointsCount: Int = 0,
    val averageSpeedKmh: Double = 0.0,
    val maxSpeedKmh: Double = 0.0,
    val purpose: String = "Field Duty",
    val isSynced: Boolean = false,
    val syncError: String? = null
)
