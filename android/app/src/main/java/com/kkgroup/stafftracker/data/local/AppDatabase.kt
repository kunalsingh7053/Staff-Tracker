package com.kkgroup.stafftracker.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.kkgroup.stafftracker.data.local.dao.AttendanceDao
import com.kkgroup.stafftracker.data.local.dao.LocationPointDao
import com.kkgroup.stafftracker.data.local.dao.TravelSessionDao
import com.kkgroup.stafftracker.data.local.entity.AttendanceEntity
import com.kkgroup.stafftracker.data.local.entity.LocationPointEntity
import com.kkgroup.stafftracker.data.local.entity.TravelSessionEntity

@Database(
    entities = [
        AttendanceEntity::class,
        TravelSessionEntity::class,
        LocationPointEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun attendanceDao(): AttendanceDao
    abstract fun travelSessionDao(): TravelSessionDao
    abstract fun locationPointDao(): LocationPointDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "staff_tracker_local.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
