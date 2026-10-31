package com.kkgroup.stafftracker.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.kkgroup.stafftracker.data.local.entity.TravelSessionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TravelSessionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(session: TravelSessionEntity)

    @Update
    suspend fun update(session: TravelSessionEntity)

    @Query("SELECT * FROM travel_sessions WHERE sessionStatus = 'IN_PROGRESS' LIMIT 1")
    suspend fun getActiveSession(): TravelSessionEntity?

    @Query("SELECT * FROM travel_sessions WHERE sessionStatus = 'IN_PROGRESS' LIMIT 1")
    fun observeActiveSession(): Flow<TravelSessionEntity?>

    @Query("SELECT * FROM travel_sessions WHERE id = :id LIMIT 1")
    suspend fun getSessionById(id: String): TravelSessionEntity?

    @Query("SELECT * FROM travel_sessions WHERE employeeId = :employeeId ORDER BY startTime DESC")
    fun getAllSessions(employeeId: String): Flow<List<TravelSessionEntity>>

    @Query("SELECT * FROM travel_sessions WHERE isSynced = 0")
    suspend fun getUnsyncedSessions(): List<TravelSessionEntity>

    @Query("UPDATE travel_sessions SET totalDistanceKm = :distanceKm, totalPointsCount = :pointsCount WHERE id = :sessionId")
    suspend fun updateProgress(sessionId: String, distanceKm: Double, pointsCount: Int)
}
