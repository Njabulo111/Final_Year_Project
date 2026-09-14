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

    private val apHistory = ApHistoryTracker()
    val stateMachine = SwitchStateMachine()

    override fun onCreate() {
        super.onCreate()
        wifiScanner = WifiScanner(this)
        networkTester = NetworkTester()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        activeInstance = this
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
        val now = System.currentTimeMillis()

        val testResult = networkTester.ping(wifiScanner.getGatewayAddress() ?: "8.8.8.8")
        val weights = db.getWeights().associate { it.metric to it.weight }
        val linkSpeedMbps = wifiScanner.getLinkSpeedMbps()

        // Feed this cycle's observations into the rolling per-BSSID history before scoring
        // off it — the connected AP gets real latency/link-speed, everyone else only RSSI
        // (Android exposes nothing else for APs the device isn't associated with).
        apHistory.addSample(
            APSample(
                bssid = connected.bssid, ssid = connected.ssid, rssi = connected.rssi,
                linkSpeedMbps = linkSpeedMbps, latencyMs = testResult.latencyMs,
                packetLossPct = testResult.packetLossPct, timestampMs = now,
            )
        )
        results.filter { !it.isConnected }.forEach { ap ->
            apHistory.addSample(
                APSample(
                    bssid = ap.bssid, ssid = ap.ssid, rssi = ap.rssi,
                    linkSpeedMbps = null, latencyMs = null, packetLossPct = null, timestampMs = now,
                )
            )
        }
        apHistory.pruneMissing(results.map { it.bssid }.toSet())

        val stability = apHistory.stabilityFor(connected.bssid)
        val is5GHz = ScoringEngine.isFiveGHzBand(connected.frequency)
        val breakdown = ScoringEngine.composite(
            rssiDbm = connected.rssi, latencyMs = testResult.latencyMs, packetLossPct = testResult.packetLossPct,
            stabilityScore = stability.stabilityScore, linkSpeedMbps = linkSpeedMbps, is5GHzBand = is5GHz,
            weights = weights,
        )
        val total = breakdown.totalScore.toInt()

        val status = when {
            total >= 85 -> "excellent"
            total >= 75 -> "good"
            total >= congestionThreshold -> "fair"
            else -> "poor"
        }

        val currentSnapshot = ApScoreSnapshot(
            bssid = connected.bssid, ssid = connected.ssid, totalScore = breakdown.totalScore,
            stabilityScore = stability.stabilityScore, hasSufficientData = stability.hasSufficientData,
        )
        val candidateSnapshots = results.filter { !it.isConnected }.mapNotNull { ap ->
            val candStability = apHistory.stabilityFor(ap.bssid)
            if (!candStability.hasSufficientData) return@mapNotNull null
            val candIs5GHz = ScoringEngine.isFiveGHzBand(ap.frequency)
            val estLinkSpeed = ScoringEngine.estimateLinkSpeedMbpsFromRssi(ap.rssi, candIs5GHz)
            val candTotal = ScoringEngine.candidateScore(ap.rssi, candStability.stabilityScore, estLinkSpeed, candIs5GHz, weights)
            ApScoreSnapshot(ap.bssid, ap.ssid, candTotal, candStability.stabilityScore, true)
        }

        val cycleResult = stateMachine.onCycle(currentSnapshot, candidateSnapshots, now)
        val switchTriggered = cycleResult is CycleResult.SwitchRecommended

        db.insertScan(
            ScanHistoryRow(
                scanId = 0,
                timestamp = isoNow(),
                ssid = connected.ssid,
                bssid = connected.bssid,
                rssiDbm = connected.rssi,
                latencyMs = testResult.latencyMs,
                packetLossPct = testResult.packetLossPct,
                signalScore = breakdown.signalScore.toInt(),
                latencyScore = breakdown.latencyScore.toInt(),
                packetlossScore = breakdown.lossScore.toInt(),
                stabilityScore = breakdown.stabilityScore.toInt(),
                totalScore = total,
                status = status,
                connected = true,
                snrProxyScore = breakdown.snrProxyScore.toInt(),
                switchTriggered = switchTriggered,
                switchAccepted = null,
                cycleState = stateMachine.state.name,
            )
        )

        if (cycleResult is CycleResult.SwitchRecommended) {
            storePendingRecommendation(cycleResult)
            AppNotifications.postSwitchRecommendation(this, cycleResult.target.ssid)
        } else if (status == "poor") {
            maybeNotifyCongestion(connected.ssid, connected.bssid, total)
        }
    }

    private fun storePendingRecommendation(recommendation: CycleResult.SwitchRecommended) {
        prefs.edit()
            .putString(PENDING_TARGET_SSID, recommendation.target.ssid)
            .putString(PENDING_TARGET_BSSID, recommendation.target.bssid)
            .putString(PENDING_CURRENT_SSID, recommendation.current.ssid)
            .putString(PENDING_CURRENT_BSSID, recommendation.current.bssid)
            .putFloat(PENDING_TARGET_SCORE, recommendation.target.totalScore.toFloat())
            .putFloat(PENDING_CURRENT_SCORE, recommendation.current.totalScore.toFloat())
            .putFloat(PENDING_TARGET_STABILITY, recommendation.target.stabilityScore.toFloat())
            .putFloat(PENDING_CURRENT_STABILITY, recommendation.current.stabilityScore.toFloat())
            .putLong(PENDING_TIMESTAMP, System.currentTimeMillis())
            .apply()
    }

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
        if (activeInstance === this) activeInstance = null
        loopJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val EXTRA_INTERVAL_SECONDS = "intervalSeconds"
        const val EXTRA_CONGESTION_THRESHOLD = "congestionThreshold"

        const val PREFS_NAME = "wifi_monitor_service"
        const val PENDING_TARGET_SSID = "pending_switch_target_ssid"
        const val PENDING_TARGET_BSSID = "pending_switch_target_bssid"
        const val PENDING_CURRENT_SSID = "pending_switch_current_ssid"
        const val PENDING_CURRENT_BSSID = "pending_switch_current_bssid"
        const val PENDING_TARGET_SCORE = "pending_switch_target_score"
        const val PENDING_CURRENT_SCORE = "pending_switch_current_score"
        const val PENDING_TARGET_STABILITY = "pending_switch_target_stability"
        const val PENDING_CURRENT_STABILITY = "pending_switch_current_stability"
        const val PENDING_TIMESTAMP = "pending_switch_timestamp"

        // The running foreground-service instance, so the Capacitor plugin (a separate
        // object, instantiated per-Activity) can report the user's accept/decline back into
        // the *same* state machine that raised the recommendation. Null when the service
        // isn't running, which is fine — there's nothing pending to respond to in that case.
        @Volatile
        private var activeInstance: MonitorService? = null

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

        /** Clears the pending recommendation and advances the state machine into COOLDOWN. */
        fun respondToPendingSwitch(context: Context, accepted: Boolean, connectSucceeded: Boolean?) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val targetSsid = prefs.getString(PENDING_TARGET_SSID, null)
            if (targetSsid != null) {
                val db = ResearchDatabase.getInstance(context)
                db.insertSwitchEvent(
                    SwitchEventRow(
                        eventId = 0,
                        timestamp = isoNow(),
                        fromSsid = prefs.getString(PENDING_CURRENT_SSID, "") ?: "",
                        fromBssid = prefs.getString(PENDING_CURRENT_BSSID, "") ?: "",
                        toSsid = targetSsid,
                        toBssid = prefs.getString(PENDING_TARGET_BSSID, "") ?: "",
                        fromTotalScore = prefs.getFloat(PENDING_CURRENT_SCORE, 0f).toInt(),
                        toTotalScore = prefs.getFloat(PENDING_TARGET_SCORE, 0f).toInt(),
                        fromStabilityScore = prefs.getFloat(PENDING_CURRENT_STABILITY, 0f).toInt(),
                        toStabilityScore = prefs.getFloat(PENDING_TARGET_STABILITY, 0f).toInt(),
                        accepted = accepted,
                        connectSucceeded = connectSucceeded,
                    )
                )
            }
            prefs.edit()
                .remove(PENDING_TARGET_SSID).remove(PENDING_TARGET_BSSID)
                .remove(PENDING_CURRENT_SSID).remove(PENDING_CURRENT_BSSID)
                .remove(PENDING_TARGET_SCORE).remove(PENDING_CURRENT_SCORE)
                .remove(PENDING_TARGET_STABILITY).remove(PENDING_CURRENT_STABILITY)
                .remove(PENDING_TIMESTAMP)
                .apply()

            val machine = activeInstance?.stateMachine
            if (accepted) machine?.onUserAccepted() else machine?.onUserDeclinedOrTimedOut()
        }
    }
}
