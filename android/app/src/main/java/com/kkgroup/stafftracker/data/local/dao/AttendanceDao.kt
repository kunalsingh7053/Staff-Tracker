package com.kkgroup.stafftracker.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.kkgroup.stafftracker.data.local.entity.AttendanceEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(attendance: AttendanceEntity)

    @Update
    suspend fun update(attendance: AttendanceEntity)

    @Query("SELECT * FROM attendance WHERE employeeId = :employeeId AND date = :date LIMIT 1")
    suspend fun getAttendanceByDate(employeeId: String, date: String): AttendanceEntity?

    @Query("SELECT * FROM attendance WHERE employeeId = :employeeId AND date = :date LIMIT 1")
    fun observeAttendanceByDate(employeeId: String, date: String): Flow<AttendanceEntity?>

    @Query("SELECT * FROM attendance WHERE employeeId = :employeeId ORDER BY date DESC")
    fun getAllAttendance(employeeId: String): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance WHERE isSynced = 0")
    suspend fun getUnsyncedAttendance(): List<AttendanceEntity>

    @Query("UPDATE attendance SET isSynced = 1, syncError = null WHERE id = :id")
    suspend fun markAsSynced(id: String)
}
