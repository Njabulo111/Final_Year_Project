package com.wificongestion.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

object AppNotifications {

    const val MONITOR_CHANNEL_ID = "wifi_monitor_watch"
    const val ALERT_CHANNEL_ID = "wifi_monitor_alerts"
    const val PERSISTENT_NOTIFICATION_ID = 1001

    private var alertNotificationId = 2000

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val watchChannel = NotificationChannel(
            MONITOR_CHANNEL_ID,
            "WiFi Monitor (background watch)",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Persistent notification shown while WiFi Monitor watches your connection in the background."
        }
        manager.createNotificationChannel(watchChannel)

        val alertChannel = NotificationChannel(
            ALERT_CHANNEL_ID,
            "WiFi Monitor alerts",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Congestion and connection alerts from WiFi Monitor."
        }
        manager.createNotificationChannel(alertChannel)
    }

    fun buildPersistentNotification(context: Context): android.app.Notification {
        ensureChannels(context)
        return NotificationCompat.Builder(context, MONITOR_CHANNEL_ID)
            .setContentTitle("WiFi Monitor")
            .setContentText("Watching your connection")
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun hasPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    fun postAlert(context: Context, title: String, text: String) {
        if (!hasPermission(context)) return
        ensureChannels(context)

        val notification = NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(alertNotificationId++, notification)
    }
}
