package com.kkgroup.stafftracker.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "location_points",
    indices = [
        Index(value = ["sessionId"]),
        Index(value = ["timestamp"]),
        Index(value = ["isSynced"])
    ]
)
data class LocationPointEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val sessionId: String,
    val employeeId: String,
    val latitude: Double,
    val longitude: Double,
    val altitude: Double = 0.0,
    val accuracy: Float,
    val speed: Float = 0.0f,
    val bearing: Float = 0.0f,
    val timestamp: Long,
    val isFiltered: Boolean = false,
    val filterReason: String? = null,
    val batteryLevel: Int? = null,
    val isCharging: Boolean = false,
    val isSynced: Boolean = false
)
