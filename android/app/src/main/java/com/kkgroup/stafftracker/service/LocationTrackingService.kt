package com.kkgroup.stafftracker.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.kkgroup.stafftracker.R
import com.kkgroup.stafftracker.StaffTrackerApplication
import com.kkgroup.stafftracker.data.local.entity.LocationPointEntity
import com.kkgroup.stafftracker.domain.location.GpsFilterEngine
import com.kkgroup.stafftracker.domain.model.FilterResult
import com.kkgroup.stafftracker.domain.model.GpsPoint
import com.kkgroup.stafftracker.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class LocationTrackingService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private val filterEngine = GpsFilterEngine()

    private var currentSessionId: String? = null
    private var currentEmployeeId: String? = null
    private var lastValidGpsPoint: GpsPoint? = null
    private var totalDistanceKm: Double = 0.0
    private var validPointsCount: Int = 0

    companion object {
        const val NOTIFICATION_ID = 1001
        const val ACTION_START_TRACKING = "com.kkgroup.stafftracker.START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.kkgroup.stafftracker.STOP_TRACKING"
        const val EXTRA_SESSION_ID = "extra_session_id"
        const val EXTRA_EMPLOYEE_ID = "extra_employee_id"
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        setupLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_TRACKING -> {
                val sessionId = intent.getStringExtra(EXTRA_SESSION_ID)
                val employeeId = intent.getStringExtra(EXTRA_EMPLOYEE_ID)
                if (!sessionId.isNullOrEmpty() && !employeeId.isNullOrEmpty()) {
                    currentSessionId = sessionId
                    currentEmployeeId = employeeId
                    startTrackingForeground()
                }
            }
            ACTION_STOP_TRACKING -> {
                stopTracking()
            }
        }
        return START_STICKY
    }

    private fun startTrackingForeground() {
        val notification = buildNotification("Field Travel Active", "Recording distance...")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        startLocationUpdates()
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L)
            .setMinUpdateIntervalMillis(3000L)
            .setMinUpdateDistanceMeters(5.0f)
            .build()

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    val rawPoint = GpsPoint(
                        latitude = location.latitude,
                        longitude = location.longitude,
                        altitude = location.altitude,
                        accuracy = location.accuracy,
                        speed = location.speed,
                        bearing = location.bearing,
                        timestamp = location.time
                    )

                    serviceScope.launch {
                        processIncomingLocation(rawPoint)
                    }
                }
            }
        }
    }

    private suspend fun processIncomingLocation(rawPoint: GpsPoint) {
        val sessionId = currentSessionId ?: return
        val employeeId = currentEmployeeId ?: return
        val app = applicationContext as StaffTrackerApplication

        val evaluation = filterEngine.evaluatePoint(rawPoint, lastValidGpsPoint)
        when (evaluation) {
            is FilterResult.Valid -> {
                totalDistanceKm += evaluation.distanceIncrementKm
                validPointsCount++
                lastValidGpsPoint = rawPoint

                val entity = LocationPointEntity(
                    sessionId = sessionId,
                    employeeId = employeeId,
                    latitude = rawPoint.latitude,
                    longitude = rawPoint.longitude,
                    altitude = rawPoint.altitude,
                    accuracy = rawPoint.accuracy,
                    speed = rawPoint.speed,
                    bearing = rawPoint.bearing,
                    timestamp = rawPoint.timestamp,
                    isFiltered = false
                )
                app.database.locationPointDao().insertPoint(entity)
                app.database.travelSessionDao().updateProgress(sessionId, totalDistanceKm, validPointsCount)

                updateNotification("Field Travel Active", "Travelled: %.2f km".format(totalDistanceKm))
            }
            is FilterResult.Filtered -> {
                val filteredEntity = LocationPointEntity(
                    sessionId = sessionId,
                    employeeId = employeeId,
                    latitude = rawPoint.latitude,
                    longitude = rawPoint.longitude,
                    altitude = rawPoint.altitude,
                    accuracy = rawPoint.accuracy,
                    speed = rawPoint.speed,
                    bearing = rawPoint.bearing,
                    timestamp = rawPoint.timestamp,
                    isFiltered = true,
                    filterReason = evaluation.reason.name
                )
                app.database.locationPointDao().insertPoint(filteredEntity)
            }
        }
    }

    private fun updateNotification(title: String, content: String) {
        val notification = buildNotification(title, content)
        val manager = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(title: String, content: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, LocationTrackingService::class.java).apply {
            action = ACTION_STOP_TRACKING
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, getString(R.string.tracking_notification_channel_id))
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_media_pause, getString(R.string.stop_tracking_action), stopPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
