# Staff Tracker Proguard Rules

# Keep Retrofit and Gson models
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.kkgroup.stafftracker.data.remote.model.** { *; }
-keep class com.google.gson.** { *; }

# Keep Room Database Entities
-keep class androidx.room.** { *; }
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class * { *; }

# Keep WorkManager workers
-keep class * extends androidx.work.Worker { *; }
-keep class * extends androidx.work.ListenableWorker { *; }

# Keep Play Services and Location
-keep class com.google.android.gms.location.** { *; }
-keep class com.google.android.gms.maps.** { *; }
