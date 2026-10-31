package com.kkgroup.stafftracker.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.kkgroup.stafftracker.StaffTrackerApplication
import com.kkgroup.stafftracker.service.LocationTrackingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BootCompletedReceiver : BroadcastReceiver {
    constructor() : super()

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val app = context.applicationContext as StaffTrackerApplication
            CoroutineScope(Dispatchers.IO).launch {
                val activeSession = app.database.travelSessionDao().getActiveSession()
                if (activeSession != null) {
                    val serviceIntent = Intent(context, LocationTrackingService::class.java).apply {
                        action = LocationTrackingService.ACTION_START_TRACKING
                        putExtra(LocationTrackingService.EXTRA_SESSION_ID, activeSession.id)
                        putExtra(LocationTrackingService.EXTRA_EMPLOYEE_ID, activeSession.employeeId)
                    }
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                }
            }
        }
    }
}
