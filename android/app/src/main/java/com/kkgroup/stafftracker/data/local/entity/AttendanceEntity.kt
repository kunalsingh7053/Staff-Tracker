package com.kkgroup.stafftracker.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "attendance",
    indices = [
        Index(value = ["employeeId", "date"], unique = true),
        Index(value = ["isSynced"])
    ]
)
data class AttendanceEntity(
    @PrimaryKey
    val id: String, // Server MongoDB ID or Local UUID
    val employeeId: String,
    val clusterId: String? = null,
    val date: String, // YYYY-MM-DD
    val checkInTimestamp: Long,
    val checkInLatitude: Double,
    val checkInLongitude: Double,
    val checkInAddress: String?,
    val checkInDeviceId: String,
    val checkOutTimestamp: Long?,
    val checkOutLatitude: Double?,
    val checkOutLongitude: Double?,
    val checkOutAddress: String?,
    val checkOutDeviceId: String?,
    val totalWorkingMinutes: Int = 0,
    val status: String, // PRESENT, HALF_DAY, LATE, etc.
    val isSynced: Boolean = false,
    val syncError: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)
