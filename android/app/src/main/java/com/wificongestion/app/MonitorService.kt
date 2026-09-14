package com.wificongestion.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MonitorService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var loopJob: Job? = null

    private lateinit var wifiScanner: WifiScanner
    private lateinit var networkTester: NetworkTester
    private lateinit var prefs: SharedPreferences

    override fun onCreate() {
        super.onCreate()
        wifiScanner = WifiScanner(this)
        networkTester = NetworkTester()
        prefs = getSharedPreferences("wifi_monitor_service", Context.MODE_PRIVATE)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val intervalSeconds = intent?.getIntExtra(EXTRA_INTERVAL_SECONDS, 15) ?: 15
        val congestionThreshold = intent?.getIntExtra(EXTRA_CONGESTION_THRESHOLD, 50) ?: 50

        val notification = AppNotifications.buildPersistentNotification(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                AppNotifications.PERSISTENT_NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(AppNotifications.PERSISTENT_NOTIFICATION_ID, notification)
        }

        if (loopJob == null) {
            loopJob = scope.launch { watchLoop(intervalSeconds.coerceAtLeast(5), congestionThreshold) }
        }

        return START_STICKY
    }

    private suspend fun watchLoop(intervalSeconds: Int, congestionThreshold: Int) {
        val db = ResearchDatabase.getInstance(applicationContext)
        while (true) {
            try {
                checkOnce(db, congestionThreshold)
            } catch (e: Exception) {
                // keep the loop alive across transient scan/ping failures
            }
            delay(intervalSeconds * 1000L)
        }
    }

    private suspend fun checkOnce(db: ResearchDatabase, congestionThreshold: Int) {
        val results = wifiScanner.scan()
        val connected = results.find { it.isConnected } ?: return

        val testResult = networkTester.ping(wifiScanner.getGatewayAddress() ?: "8.8.8.8")
        val weights = db.getWeights().associate { it.metric to it.weight }

        val signalScore = normalize(connected.rssi.toDouble(), -90.0, -30.0)
        val latencyScore = 100 - normalize(testResult.latencyMs, 0.0, 200.0)
        val lossScore = 100 - normalize(testResult.packetLossPct, 0.0, 20.0)
        val stabilityScore = 95.0

        val total = (
            signalScore * (weights["signal"] ?: 0.35) +
                latencyScore * (weights["latency"] ?: 0.30) +
                lossScore * (weights["loss"] ?: 0.20) +
                stabilityScore * (weights["stability"] ?: 0.15)
            ).toInt()

        val status = when {
            total >= 85 -> "excellent"
            total >= 75 -> "good"
            total >= congestionThreshold -> "fair"
            else -> "poor"
        }

        db.insertScan(
            ScanHistoryRow(
                scanId = 0,
                timestamp = isoNow(),
                ssid = connected.ssid,
                bssid = connected.bssid,
                rssiDbm = connected.rssi,
                latencyMs = testResult.latencyMs,
                packetLossPct = testResult.packetLossPct,
                signalScore = signalScore.toInt(),
                latencyScore = latencyScore.toInt(),
                packetlossScore = lossScore.toInt(),
                stabilityScore = stabilityScore.toInt(),
                totalScore = total,
                status = status,
                connected = true,
            )
        )

        if (status == "poor") {
            maybeNotifyCongestion(connected.ssid, connected.bssid, total)
        }
    }

    private fun normalize(value: Double, min: Double, max: Double): Double =
        ((value - min) / (max - min) * 100).coerceIn(0.0, 100.0)

    private fun maybeNotifyCongestion(ssid: String, bssid: String, score: Int) {
        val key = "last_notified_$bssid"
        val last = prefs.getLong(key, 0L)
        val now = System.currentTimeMillis()
        val throttleMs = 10 * 60 * 1000L
        if (now - last < throttleMs) return

        prefs.edit().putLong(key, now).apply()
        AppNotifications.postAlert(
            this,
            "Your connection is congested",
            "$ssid has dropped to a poor score ($score/100). A better AP may be nearby.",
        )
    }

    override fun onDestroy() {
        loopJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val EXTRA_INTERVAL_SECONDS = "intervalSeconds"
        const val EXTRA_CONGESTION_THRESHOLD = "congestionThreshold"

        fun start(context: Context, intervalSeconds: Int, congestionThreshold: Int) {
            val intent = Intent(context, MonitorService::class.java).apply {
                putExtra(EXTRA_INTERVAL_SECONDS, intervalSeconds)
                putExtra(EXTRA_CONGESTION_THRESHOLD, congestionThreshold)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, MonitorService::class.java))
        }
    }
}
