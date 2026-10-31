package com.kkgroup.stafftracker.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.kkgroup.stafftracker.data.local.entity.LocationPointEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface LocationPointDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPoint(point: LocationPointEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPoints(points: List<LocationPointEntity>)

    @Query("SELECT * FROM location_points WHERE sessionId = :sessionId AND isFiltered = 0 ORDER BY timestamp ASC")
    fun observeRoutePoints(sessionId: String): Flow<List<LocationPointEntity>>

    @Query("SELECT * FROM location_points WHERE sessionId = :sessionId AND isFiltered = 0 ORDER BY timestamp ASC")
    suspend fun getRoutePoints(sessionId: String): List<LocationPointEntity>

    @Query("SELECT * FROM location_points WHERE isSynced = 0 ORDER BY timestamp ASC LIMIT :limit")
    suspend fun getUnsyncedPoints(limit: Int = 100): List<LocationPointEntity>

    @Query("UPDATE location_points SET isSynced = 1 WHERE id IN (:ids)")
    suspend fun markPointsAsSynced(ids: List<Long>)

    @Query("SELECT * FROM location_points WHERE sessionId = :sessionId AND isFiltered = 0 ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastValidPoint(sessionId: String): LocationPointEntity?
}
